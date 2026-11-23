import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { BrowseInput, Condition, Intent } from "./shared";

function arabicOrGeneric(e: unknown): never {
  if (e instanceof Error && /[\u0600-\u06FF]/.test(e.message)) throw e;
  console.error(e);
  throw new Error("حصل خطأ غير متوقع");
}

async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    arabicOrGeneric(e);
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function browseInput(input: unknown): BrowseInput {
  const o = isRecord(input) ? input : {};
  const intent = o.intent;
  const condition = o.condition;
  return {
    q: typeof o.q === "string" ? o.q.slice(0, 80) : "",
    intent: intent === "sale" || intent === "rent" || intent === "wanted" ? intent : "all",
    category: typeof o.category === "string" ? o.category.slice(0, 40) : "",
    city: typeof o.city === "string" ? o.city.slice(0, 40) : "",
    condition:
      condition === "new" || condition === "like_new" || condition === "used" || condition === "refurbished"
        ? condition
        : "all",
    offset: Math.max(0, Math.min(5000, Math.floor(Number(o.offset) || 0))),
  };
}

function listingInput(input: unknown) {
  const o = isRecord(input) ? input : {};
  const images = Array.isArray(o.images) ? o.images.filter((x): x is string => typeof x === "string").slice(0, 4) : [];
  const price = o.price == null || o.price === "" ? null : Number(o.price);
  return {
    id: typeof o.id === "string" ? o.id : undefined,
    categoryId: typeof o.categoryId === "string" ? o.categoryId : "",
    intent: (typeof o.intent === "string" ? o.intent : "sale") as Intent,
    title: typeof o.title === "string" ? o.title : "",
    description: typeof o.description === "string" ? o.description : "",
    price: price == null || Number.isNaN(price) ? null : price,
    condition: (typeof o.condition === "string" ? o.condition : "used") as Condition,
    city: typeof o.city === "string" ? o.city : "",
    delivery: Boolean(o.delivery),
    images,
    cover: typeof o.cover === "string" ? o.cover : null,
    company: typeof o.company === "string" ? o.company : "",
  };
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context }) => run(async () => (await import("./logic.server")).getMyProfile(context.userId)));

export const listCategories = createServerFn({ method: "GET" }).handler(() =>
  run(async () => (await import("./logic.server")).listCategories()),
);

export const listListings = createServerFn({ method: "GET" })
  .validator(browseInput)
  .handler(({ data }) => run(async () => (await import("./logic.server")).browse(data)));

export const getListing = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const o = isRecord(input) ? input : {};
    return { id: typeof o.id === "string" ? o.id : "" };
  })
  .handler(({ data }) => run(async () => (await import("./logic.server")).getListing(data.id)));

export const getOwnedListing = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const o = isRecord(input) ? input : {};
    return { id: typeof o.id === "string" ? o.id : "" };
  })
  .handler(({ data, context }) =>
    run(async () => (await import("./logic.server")).getOwnedListing(context.userId, data.id)),
  );

export const createListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(listingInput)
  .handler(({ data, context }) =>
    run(async () => (await import("./logic.server")).createListing(context.userId, data)),
  );

export const updateListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(listingInput)
  .handler(({ data, context }) => {
    if (!data.id) throw new Error("الإعلان مش معروف");
    return run(async () => (await import("./logic.server")).updateListing(context.userId, data.id!, data));
  });

export const myListings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context }) => run(async () => (await import("./logic.server")).myListings(context.userId)));

export const setOwnStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const o = isRecord(input) ? input : {};
    let status: "active" | "hidden" | "sold" = "active";
    if (o.status === "hidden" || o.status === "sold" || o.status === "active") status = o.status;
    return { id: typeof o.id === "string" ? o.id : "", status };
  })
  .handler(({ data, context }) =>
    run(async () => (await import("./logic.server")).setOwnStatus(context.userId, data.id, data.status)),
  );

export const deleteOwnListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const o = isRecord(input) ? input : {};
    return { id: typeof o.id === "string" ? o.id : "" };
  })
  .handler(({ data, context }) =>
    run(async () => (await import("./logic.server")).deleteOwnListing(context.userId, data.id)),
  );

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const o = isRecord(input) ? input : {};
    return { id: typeof o.id === "string" ? o.id : "" };
  })
  .handler(({ data, context }) =>
    run(async () => (await import("./logic.server")).toggleFavorite(context.userId, data.id)),
  );

export const favoriteIds = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context }) => run(async () => (await import("./logic.server")).favoriteIds(context.userId)));

export const favoriteListings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context }) => run(async () => (await import("./logic.server")).favoriteListings(context.userId)));

export const revealPhone = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const o = isRecord(input) ? input : {};
    return { id: typeof o.id === "string" ? o.id : "" };
  })
  .handler(({ data, context }) =>
    run(async () => (await import("./logic.server")).revealPhone(context.userId, data.id)),
  );

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const o = isRecord(input) ? input : {};
    return {
      displayName: typeof o.displayName === "string" ? o.displayName : "",
      phone: typeof o.phone === "string" ? o.phone : "",
      city: typeof o.city === "string" ? o.city : "",
    };
  })
  .handler(({ data, context }) =>
    run(async () => (await import("./logic.server")).updateProfile(context.userId, data)),
  );

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const o = isRecord(input) ? input : {};
    return {
      listingId: typeof o.listingId === "string" ? o.listingId : "",
      body: typeof o.body === "string" ? o.body : "",
    };
  })
  .handler(({ data, context }) =>
    run(async () => (await import("./logic.server")).sendMessage(context.userId, data.listingId, data.body)),
  );

export const replyMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const o = isRecord(input) ? input : {};
    return {
      threadId: typeof o.threadId === "string" ? o.threadId : "",
      body: typeof o.body === "string" ? o.body : "",
    };
  })
  .handler(({ data, context }) =>
    run(async () => (await import("./logic.server")).reply(context.userId, data.threadId, data.body)),
  );

export const myThreads = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context }) => run(async () => (await import("./logic.server")).myThreads(context.userId)));

export const getThread = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const o = isRecord(input) ? input : {};
    return { id: typeof o.id === "string" ? o.id : "" };
  })
  .handler(({ data, context }) =>
    run(async () => (await import("./logic.server")).getThread(context.userId, data.id)),
  );

export const reportListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const o = isRecord(input) ? input : {};
    return {
      id: typeof o.id === "string" ? o.id : "",
      reason: typeof o.reason === "string" ? o.reason : "",
    };
  })
  .handler(({ data, context }) =>
    run(async () => (await import("./logic.server")).reportListing(context.userId, data.id, data.reason)),
  );

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context }) => run(async () => (await import("./logic.server")).adminOverview(context.userId)));

export const adminListings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const o = isRecord(input) ? input : {};
    return {
      q: typeof o.q === "string" ? o.q : "",
      status: typeof o.status === "string" ? o.status : "all",
    };
  })
  .handler(({ data, context }) =>
    run(async () => (await import("./logic.server")).adminListings(context.userId, data.q, data.status)),
  );

export const adminUsers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const o = isRecord(input) ? input : {};
    return { q: typeof o.q === "string" ? o.q : "" };
  })
  .handler(({ data, context }) =>
    run(async () => (await import("./logic.server")).adminUsers(context.userId, data.q)),
  );

export const adminReports = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context }) => run(async () => (await import("./logic.server")).adminReports(context.userId)));

export const adminAct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(({ data, context }) =>
    run(async () => (await import("./logic.server")).adminAct(context.userId, data as never)),
  );
