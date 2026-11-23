import { getSql } from "@/lib/db";
import {
  CATEGORIES,
  CITIES,
  CONDITIONS,
  INTENTS,
  PHONE_EMAIL_DOMAIN,
  cleanText,
  identifierToLogin,
  normalizePhone,
  visibleEmail,
  type BrowseInput,
  type Category,
  type Condition,
  type Intent,
  type ListingCard,
  type ListingDetail,
  type ListingStatus,
  type MyProfile,
} from "./shared";

const hits = new Map<string, number[]>();

function limit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  }
  return true;
}

function fail(message: string): never {
  throw new Error(message);
}

function asIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

function asNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asBool(v: unknown): boolean {
  return v === true || v === "t" || v === "true" || v === 1;
}

type ProfileRow = {
  user_id: string;
  display_name: string;
  phone: string | null;
  city: string | null;
  role: string;
  banned: boolean;
  created_at: unknown;
};

async function isSeedAdmin(userId: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ ok: number }>`
    select 1 as ok
    from "user" u
    join admin_emails e on lower(u.email) = e.email
    where u.id = ${userId}
    limit 1
  `;
  return rows.length > 0;
}

async function loadUser(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ id: string; email: string; name: string }>`
    select id, email, name from "user" where id = ${userId} limit 1
  `;
  return rows[0] ?? null;
}

export async function getMyProfile(userId: string): Promise<MyProfile> {
  const user = await loadUser(userId);
  if (!user) fail("الحساب مش موجود");
  const sql = await getSql();
  const seed = await isSeedAdmin(userId);
  const pending = await sql<{ ok: number }>`
    select 1 as ok from pending_admins where email = ${user.email.toLowerCase()} limit 1
  `;
  const role = seed || pending.length > 0 ? "admin" : "user";
  const existing = await sql<ProfileRow>`select * from profiles where user_id = ${userId} limit 1`;
  let row = existing[0];
  if (!row) {
    const inserted = await sql<ProfileRow>`
      insert into profiles (user_id, display_name, role)
      values (${userId}, ${cleanText(user.name || "عضو", 40) || "عضو"}, ${role})
      returning *
    `;
    row = inserted[0]!;
  } else if (role === "admin" && row.role !== "admin") {
    const updated = await sql<ProfileRow>`
      update profiles set role = 'admin' where user_id = ${userId} returning *
    `;
    row = updated[0]!;
  }
  const unread = await sql<{ n: number }>`
    select count(*) as n
    from messages m
    join threads t on t.id = m.thread_id
    where m.read_at is null
      and m.sender_id <> ${userId}
      and (t.buyer_id = ${userId} or t.seller_id = ${userId})
  `;
  return {
    displayName: row.display_name,
    phone: row.phone,
    city: row.city,
    role: row.role === "admin" ? "admin" : "user",
    banned: asBool(row.banned),
    email: visibleEmail(user.email),
    unread: asNum(unread[0]?.n),
  };
}

async function requireActive(userId: string): Promise<ProfileRow> {
  const profile = await getMyProfile(userId);
  if (profile.banned) fail("الحساب موقوف. تقدر تتواصل مع الإدارة.");
  const sql = await getSql();
  const rows = await sql<ProfileRow>`select * from profiles where user_id = ${userId} limit 1`;
  if (!rows[0]) fail("الحساب مش موجود");
  return rows[0];
}

async function requireAdmin(userId: string): Promise<void> {
  const profile = await getMyProfile(userId);
  if (profile.banned || profile.role !== "admin") fail("الأمر ده للأدمن بس");
}

function assertJpeg(dataUrl: string, max: number, label: string) {
  if (!dataUrl.startsWith("data:image/jpeg;base64,")) fail(`${label} لازم تكون صورة`);
  if (dataUrl.length > max) fail(`${label} كبيرة زيادة`);
  if (!/^data:image\/jpeg;base64,[a-z0-9+/=\s]+$/i.test(dataUrl)) fail(`${label} مش صالحة`);
}

type ListingInput = {
  id?: string;
  categoryId: string;
  intent: Intent;
  title: string;
  description: string;
  price: number | null;
  condition: Condition;
  city: string;
  delivery: boolean;
  images: string[];
  cover: string | null;
  company: string;
};

function parseListing(input: ListingInput, partial = false) {
  if (input.company.trim()) fail("تعذر النشر");
  const categoryId = input.categoryId;
  if (!CATEGORIES.some((c) => c.id === categoryId)) fail("اختار قسم صحيح");
  if (!INTENTS.some((i) => i.id === input.intent)) fail("نوع الإعلان مش صحيح");
  if (!CONDITIONS.some((c) => c.id === input.condition)) fail("حالة الجهاز مش صحيحة");
  if (!(CITIES as readonly string[]).includes(input.city)) fail("اختار محافظة");
  const title = cleanText(input.title, 80);
  const description = cleanText(input.description, 4000);
  if (title.length < 4) fail("العنوان قصير");
  if (description.length < 10) fail("اكتب وصف أوضح (١٠ حروف على الأقل)");
  let price: number | null = null;
  if (input.price != null && input.price !== ("" as unknown)) {
    const n = Math.round(Number(input.price));
    if (!Number.isFinite(n) || n < 0 || n > 50_000_000) fail("السعر مش منطقي");
    price = n === 0 ? null : n;
  }
  const images = (input.images ?? []).slice(0, 4);
  for (const img of images) assertJpeg(img, 200_000, "الصورة");
  if (input.cover) assertJpeg(input.cover, 60_000, "الغلاف");
  if (!partial && images.length > 4) fail("أربع صور بالكتير");
  return {
    categoryId,
    intent: input.intent,
    title,
    description,
    price,
    condition: input.condition,
    city: input.city,
    delivery: Boolean(input.delivery),
    images,
    cover: input.cover,
  };
}

async function replaceImages(listingId: string, images: string[], cover: string | null) {
  const sql = await getSql();
  await sql`delete from listing_images where listing_id = ${listingId}`;
  for (let i = 0; i < images.length; i += 1) {
    await sql`
      insert into listing_images (id, listing_id, data_url, sort_order)
      values (${crypto.randomUUID()}, ${listingId}, ${images[i]}, ${i})
    `;
  }
  await sql`update listings set cover = ${cover} where id = ${listingId}`;
}

export async function createListing(userId: string, input: ListingInput) {
  if (!limit(`post:${userId}`, 12, 60 * 60 * 1000)) fail("وصلت للحد المسموح من الإعلانات مؤقتًا");
  await requireActive(userId);
  const data = parseListing(input);
  const sql = await getSql();
  const activeCat = await sql<{ id: string }>`
    select id from categories where id = ${data.categoryId} and active = true limit 1
  `;
  if (!activeCat[0]) fail("القسم ده متوقف حاليًا");
  const id = crypto.randomUUID();
  await sql`
    insert into listings (
      id, user_id, category_id, intent, title, description, price, condition, city, delivery, cover
    ) values (
      ${id}, ${userId}, ${data.categoryId}, ${data.intent}, ${data.title}, ${data.description},
      ${data.price}, ${data.condition}, ${data.city}, ${data.delivery}, ${data.cover}
    )
  `;
  await replaceImages(id, data.images, data.cover);
  return { id };
}

export async function updateListing(userId: string, id: string, input: ListingInput) {
  await requireActive(userId);
  if (!/^[\w-]{8,80}$/.test(id)) fail("إعلان مش معروف");
  const data = parseListing(input);
  const sql = await getSql();
  const rows = await sql<{ id: string; status: string }>`
    select id, status from listings where id = ${id} and user_id = ${userId} limit 1
  `;
  if (!rows[0]) fail("الإعلان مش بتاعك");
  if (rows[0].status === "rejected") fail("الإعلان مرفوض. كلم الإدارة.");
  await sql`
    update listings set
      category_id = ${data.categoryId},
      intent = ${data.intent},
      title = ${data.title},
      description = ${data.description},
      price = ${data.price},
      condition = ${data.condition},
      city = ${data.city},
      delivery = ${data.delivery},
      updated_at = now()
    where id = ${id} and user_id = ${userId}
  `;
  await replaceImages(id, data.images, data.cover);
  return { id };
}

const CARD_SELECT = `
  l.id, l.title, l.price, l.intent, l.condition, l.city, l.delivery, l.featured,
  l.status, l.created_at, l.category_id, c.name_ar as category_name, l.cover,
  p.display_name as seller_name
`;

function mapCard(row: Record<string, unknown>): ListingCard {
  return {
    id: String(row.id),
    title: String(row.title),
    price: row.price == null ? null : asNum(row.price),
    intent: String(row.intent) as Intent,
    condition: String(row.condition) as Condition,
    city: String(row.city),
    delivery: asBool(row.delivery),
    featured: asBool(row.featured),
    status: String(row.status) as ListingStatus,
    createdAt: asIso(row.created_at),
    categoryId: String(row.category_id),
    categoryName: String(row.category_name ?? ""),
    cover: row.cover ? String(row.cover) : null,
    sellerName: String(row.seller_name ?? "عضو"),
  };
}

export async function browse(input: BrowseInput): Promise<{ items: ListingCard[]; total: number }> {
  const sql = await getSql();
  const where = ["l.status = 'active'"];
  const params: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    params.push(value);
    where.push(clause.replace("?", `$${params.length}`));
  };
  const q = cleanText(input.q ?? "", 80);
  if (q) {
    params.push(`%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    where.push(`(l.title ilike $${params.length} escape '\\' or l.description ilike $${params.length} escape '\\')`);
  }
  if (input.intent && input.intent !== "all" && INTENTS.some((i) => i.id === input.intent)) {
    add("l.intent = ?", input.intent);
  }
  if (input.category && CATEGORIES.some((c) => c.id === input.category)) {
    add("l.category_id = ?", input.category);
  }
  if (input.city && (CITIES as readonly string[]).includes(input.city)) {
    add("l.city = ?", input.city);
  }
  if (input.condition && input.condition !== "all" && CONDITIONS.some((c) => c.id === input.condition)) {
    add("l.condition = ?", input.condition);
  }
  const whereSql = where.join(" and ");
  const offset = Math.max(0, Math.min(5000, Math.floor(input.offset || 0)));
  const totalRows = await sql.query<{ n: number }>(
    `select count(*) as n from listings l where ${whereSql}`,
    params,
  );
  const rows = await sql.query<Record<string, unknown>>(
    `select ${CARD_SELECT}
     from listings l
     join profiles p on p.user_id = l.user_id
     join categories c on c.id = l.category_id
     where ${whereSql}
     order by l.featured desc, l.created_at desc
     limit 24 offset ${offset}`,
    params,
  );
  return { items: rows.map(mapCard), total: asNum(totalRows[0]?.n) };
}

export async function getListing(id: string): Promise<ListingDetail | null> {
  if (!/^[\w-]{8,80}$/.test(id)) return null;
  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    `select ${CARD_SELECT}, l.description, l.views, l.user_id as seller_id,
            (p.phone is not null) as has_phone
     from listings l
     join profiles p on p.user_id = l.user_id
     join categories c on c.id = l.category_id
     where l.id = $1 and l.status in ('active', 'sold')
     limit 1`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  await sql`update listings set views = views + 1 where id = ${id} and status = 'active'`;
  const images = await sql<{ data_url: string }>`
    select data_url from listing_images where listing_id = ${id} order by sort_order asc
  `;
  const card = mapCard(row);
  return {
    ...card,
    description: String(row.description ?? ""),
    views: asNum(row.views) + (card.status === "active" ? 1 : 0),
    sellerId: String(row.seller_id),
    hasPhone: asBool(row.has_phone),
    images: images.map((i) => i.data_url),
  };
}

export async function getOwnedListing(userId: string, id: string) {
  await requireActive(userId);
  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    `select l.*, c.name_ar as category_name, p.display_name as seller_name
     from listings l
     join categories c on c.id = l.category_id
     join profiles p on p.user_id = l.user_id
     where l.id = $1 and l.user_id = $2
     limit 1`,
    [id, userId],
  );
  const row = rows[0];
  if (!row) return null;
  const images = await sql<{ data_url: string }>`
    select data_url from listing_images where listing_id = ${id} order by sort_order asc
  `;
  return {
    ...mapCard(row),
    description: String(row.description ?? ""),
    images: images.map((i) => i.data_url),
  };
}

export async function myListings(userId: string): Promise<ListingCard[]> {
  await getMyProfile(userId);
  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    `select ${CARD_SELECT}
     from listings l
     join profiles p on p.user_id = l.user_id
     join categories c on c.id = l.category_id
     where l.user_id = $1
     order by l.created_at desc
     limit 100`,
    [userId],
  );
  return rows.map(mapCard);
}

export async function setOwnStatus(userId: string, id: string, status: "active" | "hidden" | "sold") {
  await requireActive(userId);
  const sql = await getSql();
  const rows = await sql<{ status: string }>`
    select status from listings where id = ${id} and user_id = ${userId} limit 1
  `;
  if (!rows[0]) fail("الإعلان مش بتاعك");
  if (rows[0].status === "rejected") fail("الإعلان مرفوض");
  await sql`
    update listings set status = ${status}, updated_at = now()
    where id = ${id} and user_id = ${userId}
  `;
  return { ok: true };
}

export async function deleteOwnListing(userId: string, id: string) {
  await requireActive(userId);
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    delete from listings where id = ${id} and user_id = ${userId} returning id
  `;
  if (!rows[0]) fail("الإعلان مش بتاعك");
  return { ok: true };
}

export async function listCategories(): Promise<Category[]> {
  const sql = await getSql();
  const rows = await sql<{ id: string; name_ar: string; group_name: string; active: boolean }>`
    select id, name_ar, group_name, active from categories order by sort_order asc
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name_ar,
    group: r.group_name,
    active: asBool(r.active),
  }));
}

export async function toggleFavorite(userId: string, listingId: string) {
  await requireActive(userId);
  const sql = await getSql();
  const found = await sql<{ listing_id: string }>`
    select listing_id from favorites where user_id = ${userId} and listing_id = ${listingId} limit 1
  `;
  if (found[0]) {
    await sql`delete from favorites where user_id = ${userId} and listing_id = ${listingId}`;
    return { on: false };
  }
  const listing = await sql<{ id: string }>`
    select id from listings where id = ${listingId} and status in ('active', 'sold') limit 1
  `;
  if (!listing[0]) fail("الإعلان مش متاح");
  await sql`insert into favorites (user_id, listing_id) values (${userId}, ${listingId})`;
  return { on: true };
}

export async function favoriteIds(userId: string): Promise<string[]> {
  const sql = await getSql();
  const rows = await sql<{ listing_id: string }>`
    select listing_id from favorites where user_id = ${userId}
  `;
  return rows.map((r) => r.listing_id);
}

export async function favoriteListings(userId: string): Promise<ListingCard[]> {
  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    `select ${CARD_SELECT}
     from favorites f
     join listings l on l.id = f.listing_id
     join profiles p on p.user_id = l.user_id
     join categories c on c.id = l.category_id
     where f.user_id = $1 and l.status in ('active', 'sold')
     order by f.created_at desc
     limit 100`,
    [userId],
  );
  return rows.map(mapCard);
}

export async function revealPhone(userId: string, listingId: string): Promise<{ phone: string | null }> {
  await requireActive(userId);
  if (!limit(`phone:${userId}`, 40, 10 * 60 * 1000)) fail("استنيت شوية قبل ما تطلب أرقام تانية");
  const sql = await getSql();
  const rows = await sql<{ phone: string | null }>`
    select p.phone
    from listings l
    join profiles p on p.user_id = l.user_id
    where l.id = ${listingId} and l.status in ('active', 'sold') and p.banned = false
    limit 1
  `;
  if (!rows[0]) fail("الإعلان مش متاح");
  return { phone: rows[0].phone };
}

export async function updateProfile(
  userId: string,
  input: { displayName: string; phone: string; city: string },
) {
  await requireActive(userId);
  const displayName = cleanText(input.displayName, 40);
  if (displayName.length < 2) fail("الاسم قصير");
  const city = input.city ? input.city : null;
  if (city && !(CITIES as readonly string[]).includes(city)) fail("المحافظة مش صحيحة");
  let phone: string | null = null;
  if (input.phone.trim()) {
    phone = normalizePhone(input.phone);
    if (!phone) fail("رقم الموبايل مش صحيح");
  }
  const sql = await getSql();
  try {
    await sql`
      update profiles
      set display_name = ${displayName}, phone = ${phone}, city = ${city}
      where user_id = ${userId}
    `;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/unique|duplicate|profiles_phone/i.test(msg)) fail("رقم الموبايل مستخدم على حساب تاني");
    throw e;
  }
  await sql`update "user" set name = ${displayName}, "updatedAt" = now() where id = ${userId}`;
  return getMyProfile(userId);
}

export async function sendMessage(userId: string, listingId: string, bodyRaw: string) {
  if (!limit(`msg:${userId}`, 40, 10 * 60 * 1000)) fail("رسائل كتير بسرعة. استنى دقيقة.");
  await requireActive(userId);
  const body = cleanText(bodyRaw, 2000);
  if (body.length < 1) fail("اكتب رسالة");
  const sql = await getSql();
  const listing = await sql<{ user_id: string; status: string }>`
    select user_id, status from listings where id = ${listingId} limit 1
  `;
  if (!listing[0] || !["active", "sold"].includes(listing[0].status)) fail("الإعلان مش متاح");
  const sellerId = listing[0].user_id;
  if (sellerId === userId) fail("متقدرش تراسل إعلانك");
  const existing = await sql<{ id: string }>`
    select id from threads where listing_id = ${listingId} and buyer_id = ${userId} limit 1
  `;
  let threadId = existing[0]?.id;
  if (!threadId) {
    threadId = crypto.randomUUID();
    await sql`
      insert into threads (id, listing_id, buyer_id, seller_id)
      values (${threadId}, ${listingId}, ${userId}, ${sellerId})
    `;
  }
  const messageId = crypto.randomUUID();
  await sql`
    insert into messages (id, thread_id, sender_id, body) values (${messageId}, ${threadId}, ${userId}, ${body})
  `;
  await sql`update threads set updated_at = now() where id = ${threadId}`;
  return { threadId };
}

export async function reply(userId: string, threadId: string, bodyRaw: string) {
  if (!limit(`msg:${userId}`, 40, 10 * 60 * 1000)) fail("رسائل كتير بسرعة. استنى دقيقة.");
  await requireActive(userId);
  const body = cleanText(bodyRaw, 2000);
  if (!body) fail("اكتب رسالة");
  const sql = await getSql();
  const threads = await sql<{ id: string }>`
    select id from threads
    where id = ${threadId} and (buyer_id = ${userId} or seller_id = ${userId})
    limit 1
  `;
  if (!threads[0]) fail("المحادثة مش متاحة");
  await sql`
    insert into messages (id, thread_id, sender_id, body)
    values (${crypto.randomUUID()}, ${threadId}, ${userId}, ${body})
  `;
  await sql`update threads set updated_at = now() where id = ${threadId}`;
  return { ok: true };
}

export type ThreadSummary = {
  id: string;
  listingId: string;
  listingTitle: string;
  cover: string | null;
  otherName: string;
  lastBody: string;
  unread: number;
  updatedAt: string;
};

export async function myThreads(userId: string): Promise<ThreadSummary[]> {
  await getMyProfile(userId);
  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    `select t.id, t.listing_id, t.updated_at, l.title as listing_title, l.cover,
            case when t.buyer_id = $1 then sp.display_name else bp.display_name end as other_name,
            (select m.body from messages m where m.thread_id = t.id order by m.created_at desc limit 1) as last_body,
            (select count(*) from messages m where m.thread_id = t.id and m.sender_id <> $1 and m.read_at is null) as unread
     from threads t
     join listings l on l.id = t.listing_id
     join profiles bp on bp.user_id = t.buyer_id
     join profiles sp on sp.user_id = t.seller_id
     where t.buyer_id = $1 or t.seller_id = $1
     order by t.updated_at desc
     limit 80`,
    [userId],
  );
  return rows.map((r) => ({
    id: String(r.id),
    listingId: String(r.listing_id),
    listingTitle: String(r.listing_title),
    cover: r.cover ? String(r.cover) : null,
    otherName: String(r.other_name ?? "عضو"),
    lastBody: String(r.last_body ?? ""),
    unread: asNum(r.unread),
    updatedAt: asIso(r.updated_at),
  }));
}

export async function getThread(userId: string, threadId: string) {
  await getMyProfile(userId);
  const sql = await getSql();
  const threads = await sql.query<Record<string, unknown>>(
    `select t.id, t.listing_id, t.buyer_id, t.seller_id, l.title as listing_title,
            case when t.buyer_id = $2 then sp.display_name else bp.display_name end as other_name
     from threads t
     join listings l on l.id = t.listing_id
     join profiles bp on bp.user_id = t.buyer_id
     join profiles sp on sp.user_id = t.seller_id
     where t.id = $1 and (t.buyer_id = $2 or t.seller_id = $2)
     limit 1`,
    [threadId, userId],
  );
  const thread = threads[0];
  if (!thread) return null;
  await sql`
    update messages set read_at = now()
    where thread_id = ${threadId} and sender_id <> ${userId} and read_at is null
  `;
  const messages = await sql<{ id: string; sender_id: string; body: string; created_at: unknown }>`
    select id, sender_id, body, created_at from messages
    where thread_id = ${threadId}
    order by created_at asc
    limit 300
  `;
  return {
    id: String(thread.id),
    listingId: String(thread.listing_id),
    listingTitle: String(thread.listing_title),
    otherName: String(thread.other_name ?? "عضو"),
    messages: messages.map((m) => ({
      id: m.id,
      mine: m.sender_id === userId,
      body: m.body,
      createdAt: asIso(m.created_at),
    })),
  };
}

export async function reportListing(userId: string, listingId: string, reasonRaw: string) {
  if (!limit(`report:${userId}`, 10, 60 * 60 * 1000)) fail("بلاغات كتير. حاول لاحقًا.");
  await requireActive(userId);
  const reason = cleanText(reasonRaw, 500);
  if (reason.length < 4) fail("اكتب سبب البلاغ");
  const sql = await getSql();
  const listing = await sql<{ id: string }>`select id from listings where id = ${listingId} limit 1`;
  if (!listing[0]) fail("الإعلان مش موجود");
  try {
    await sql`
      insert into reports (id, listing_id, reporter_id, reason)
      values (${crypto.randomUUID()}, ${listingId}, ${userId}, ${reason})
    `;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/unique|duplicate/i.test(msg)) fail("اتبعت بلاغ على الإعلان ده قبل كده");
    throw e;
  }
  return { ok: true };
}

async function logAdmin(adminId: string, action: string, target: string) {
  const sql = await getSql();
  await sql`
    insert into admin_log (id, admin_id, action, target)
    values (${crypto.randomUUID()}, ${adminId}, ${action}, ${target.slice(0, 180)})
  `;
}

export async function adminOverview(userId: string) {
  await requireAdmin(userId);
  const sql = await getSql();
  const counts = await sql<{
    listings: number;
    active: number;
    rejected: number;
    users: number;
    admins: number;
    reports: number;
  }>`
    select
      (select count(*) from listings) as listings,
      (select count(*) from listings where status = 'active') as active,
      (select count(*) from listings where status = 'rejected') as rejected,
      (select count(*) from "user") as users,
      (select count(*) from profiles where role = 'admin') as admins,
      (select count(*) from reports where status = 'open') as reports
  `;
  const log = await sql<{ action: string; target: string | null; created_at: unknown; name: string }>`
    select a.action, a.target, a.created_at, coalesce(p.display_name, 'أدمن') as name
    from admin_log a
    left join profiles p on p.user_id = a.admin_id
    order by a.created_at desc
    limit 12
  `;
  const c = counts[0];
  return {
    listings: asNum(c?.listings),
    active: asNum(c?.active),
    rejected: asNum(c?.rejected),
    users: asNum(c?.users),
    admins: asNum(c?.admins),
    reports: asNum(c?.reports),
    log: log.map((r) => ({
      action: r.action,
      target: r.target,
      name: r.name,
      createdAt: asIso(r.created_at),
    })),
  };
}

export async function adminListings(userId: string, q: string, status: string) {
  await requireAdmin(userId);
  const sql = await getSql();
  const params: unknown[] = [];
  const where: string[] = ["true"];
  if (status && status !== "all") {
    params.push(status);
    where.push(`l.status = $${params.length}`);
  }
  const query = cleanText(q, 80);
  if (query) {
    params.push(`%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    where.push(`(l.title ilike $${params.length} escape '\\' or u.email ilike $${params.length} escape '\\')`);
  }
  const rows = await sql.query<Record<string, unknown>>(
    `select l.id, l.title, l.status, l.featured, l.intent, l.city, l.price, l.created_at,
            p.display_name, u.email
     from listings l
     join profiles p on p.user_id = l.user_id
     join "user" u on u.id = l.user_id
     where ${where.join(" and ")}
     order by l.created_at desc
     limit 80`,
    params,
  );
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    status: String(r.status),
    featured: asBool(r.featured),
    intent: String(r.intent),
    city: String(r.city),
    price: r.price == null ? null : asNum(r.price),
    createdAt: asIso(r.created_at),
    seller: String(r.display_name),
    email: visibleEmail(String(r.email)) ?? "دخول برقم",
  }));
}

export async function adminUsers(userId: string, q: string) {
  await requireAdmin(userId);
  const sql = await getSql();
  const params: unknown[] = [];
  let filter = "";
  const query = cleanText(q, 80);
  if (query) {
    params.push(`%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    filter = `where u.email ilike $1 escape '\\' or u.name ilike $1 escape '\\' or p.phone ilike $1 escape '\\' or p.display_name ilike $1 escape '\\'`;
  }
  const rows = await sql.query<Record<string, unknown>>(
    `select u.id, u.email, p.display_name, p.phone, p.role, p.banned, u."createdAt" as created_at,
            (select count(*) from listings l where l.user_id = u.id) as listings
     from "user" u
     left join profiles p on p.user_id = u.id
     ${filter}
     order by u."createdAt" desc
     limit 80`,
    params,
  );
  return rows.map((r) => ({
    id: String(r.id),
    email: visibleEmail(String(r.email)) ?? "دخول برقم",
    rawEmail: String(r.email),
    name: String(r.display_name ?? r.email),
    phone: r.phone ? String(r.phone) : null,
    role: r.role === "admin" ? "admin" : "user",
    banned: asBool(r.banned),
    listings: asNum(r.listings),
    createdAt: asIso(r.created_at),
    seed: String(r.email).endsWith(`@${PHONE_EMAIL_DOMAIN}`)
      ? false
      : ["felominalale@gmail.com", "fmina6812@gmail.com", "nermofelololo@gmail.com"].includes(
          String(r.email).toLowerCase(),
        ),
  }));
}

export async function adminReports(userId: string) {
  await requireAdmin(userId);
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    listing_id: string;
    reason: string;
    status: string;
    created_at: unknown;
    title: string;
    reporter: string;
  }>`
    select r.id, r.listing_id, r.reason, r.status, r.created_at, l.title, p.display_name as reporter
    from reports r
    join listings l on l.id = r.listing_id
    join profiles p on p.user_id = r.reporter_id
    order by case when r.status = 'open' then 0 else 1 end, r.created_at desc
    limit 80
  `;
  return rows.map((r) => ({
    id: r.id,
    listingId: r.listing_id,
    reason: r.reason,
    status: r.status,
    createdAt: asIso(r.created_at),
    title: r.title,
    reporter: r.reporter,
  }));
}

export async function adminAct(
  userId: string,
  input:
    | { type: "listing"; id: string; action: "feature" | "unfeature" | "hide" | "reject" | "restore" | "delete" | "sold" }
    | { type: "user"; id: string; action: "ban" | "unban" | "promote" | "demote" }
    | { type: "grant"; identifier: string }
    | { type: "report"; id: string; action: "dismiss" | "reject-listing" }
    | { type: "category"; id: string; active: boolean },
) {
  await requireAdmin(userId);
  const sql = await getSql();
  if (input.type === "listing") {
    if (input.action === "delete") {
      await sql`delete from listings where id = ${input.id}`;
    } else if (input.action === "feature" || input.action === "unfeature") {
      await sql`update listings set featured = ${input.action === "feature"}, updated_at = now() where id = ${input.id}`;
    } else {
      const status =
        input.action === "hide" ? "hidden" : input.action === "reject" ? "rejected" : input.action === "sold" ? "sold" : "active";
      await sql`update listings set status = ${status}, updated_at = now() where id = ${input.id}`;
    }
    await logAdmin(userId, `listing:${input.action}`, input.id);
    return { ok: true };
  }
  if (input.type === "user") {
    const target = await loadUser(input.id);
    if (!target) fail("المستخدم مش موجود");
    const seed = await isSeedAdmin(input.id);
    if ((input.action === "ban" || input.action === "demote") && seed) {
      fail("حسابات الأدمن الأساسية متتغيّرش");
    }
    if (input.action === "ban" || input.action === "unban") {
      const banned = input.action === "ban";
      await sql`
        insert into profiles (user_id, display_name, role, banned)
        values (${input.id}, ${cleanText(target.name || "عضو", 40) || "عضو"}, 'user', ${banned})
        on conflict (user_id) do update set banned = ${banned}
      `;
      if (banned) {
        await sql`update listings set status = 'hidden', updated_at = now() where user_id = ${input.id} and status = 'active'`;
      }
    } else if (input.action === "promote") {
      await sql`
        insert into profiles (user_id, display_name, role)
        values (${input.id}, ${cleanText(target.name || "عضو", 40) || "عضو"}, 'admin')
        on conflict (user_id) do update set role = 'admin'
      `;
      await sql`
        insert into pending_admins (email) values (${target.email.toLowerCase()})
        on conflict (email) do nothing
      `;
    } else {
      await sql`update profiles set role = 'user' where user_id = ${input.id}`;
      await sql`delete from pending_admins where email = ${target.email.toLowerCase()}`;
    }
    await logAdmin(userId, `user:${input.action}`, target.email);
    return { ok: true };
  }
  if (input.type === "grant") {
    const parsed = (() => {
      try {
        return identifierToLogin(input.identifier).email;
      } catch (e) {
        fail(e instanceof Error ? e.message : "الإيميل أو الرقم مش صحيح");
      }
    })();
    const email = parsed;
    await sql`
      insert into pending_admins (email) values (${email})
      on conflict (email) do nothing
    `;
    await sql`
      update profiles set role = 'admin'
      where user_id = (select id from "user" where lower(email) = ${email} limit 1)
    `;
    await logAdmin(userId, "grant", email.endsWith(`@${PHONE_EMAIL_DOMAIN}`) ? "phone" : email);
    return { ok: true };
  }
  if (input.type === "report") {
    const reports = await sql<{ listing_id: string }>`select listing_id from reports where id = ${input.id} limit 1`;
    if (!reports[0]) fail("البلاغ مش موجود");
    await sql`update reports set status = 'closed' where id = ${input.id}`;
    if (input.action === "reject-listing") {
      await sql`update listings set status = 'rejected', updated_at = now() where id = ${reports[0].listing_id}`;
    }
    await logAdmin(userId, `report:${input.action}`, reports[0].listing_id);
    return { ok: true };
  }
  if (!CATEGORIES.some((c) => c.id === input.id)) fail("قسم مش معروف");
  await sql`update categories set active = ${input.active} where id = ${input.id}`;
  await logAdmin(userId, input.active ? "category:on" : "category:off", input.id);
  return { ok: true };
}
