export const PHONE_EMAIL_DOMAIN = "phone.likenew.local";

export const CATEGORIES = [
  { id: "dental", group: "التخصصات", name: "طب الأسنان" },
  { id: "internal", group: "التخصصات", name: "الباطنة والطب العام" },
  { id: "surgery", group: "التخصصات", name: "الجراحة" },
  { id: "cardio", group: "التخصصات", name: "القلب والأوعية" },
  { id: "ortho", group: "التخصصات", name: "العظام" },
  { id: "eyes", group: "التخصصات", name: "العيون" },
  { id: "ent", group: "التخصصات", name: "الأنف والأذن والحنجرة" },
  { id: "peds", group: "التخصصات", name: "الأطفال" },
  { id: "obgyn", group: "التخصصات", name: "النساء والتوليد" },
  { id: "derma", group: "التخصصات", name: "الجلدية" },
  { id: "radio", group: "التخصصات", name: "الأشعة والتصوير" },
  { id: "lab", group: "التخصصات", name: "المختبرات والتحاليل" },
  { id: "anesth", group: "التخصصات", name: "التخدير والعناية" },
  { id: "neuro", group: "التخصصات", name: "المخ والأعصاب" },
  { id: "uro", group: "التخصصات", name: "المسالك البولية" },
  { id: "onco", group: "التخصصات", name: "الأورام" },
  { id: "psych", group: "التخصصات", name: "الطب النفسي" },
  { id: "physio", group: "التخصصات", name: "العلاج الطبيعي" },
  { id: "pharmacy", group: "التخصصات", name: "الصيدلة" },
  { id: "nursing", group: "التخصصات", name: "التمريض" },
  { id: "vet", group: "التخصصات", name: "الطب البيطري" },
  { id: "devices", group: "التجهيزات", name: "أجهزة طبية عامة" },
  { id: "consumables", group: "التجهيزات", name: "مستهلكات ومعقمات" },
  { id: "furniture", group: "التجهيزات", name: "أثاث وتجهيز عيادات" },
  { id: "other", group: "التجهيزات", name: "أخرى" },
] as const;

export const CITIES = [
  "القاهرة",
  "الجيزة",
  "الإسكندرية",
  "الدقهلية",
  "الشرقية",
  "القليوبية",
  "كفر الشيخ",
  "الغربية",
  "المنوفية",
  "البحيرة",
  "دمياط",
  "بورسعيد",
  "الإسماعيلية",
  "السويس",
  "شمال سيناء",
  "جنوب سيناء",
  "بني سويف",
  "الفيوم",
  "المنيا",
  "أسيوط",
  "سوهاج",
  "قنا",
  "الأقصر",
  "أسوان",
  "البحر الأحمر",
  "الوادي الجديد",
  "مطروح",
] as const;

export const INTENTS = [
  { id: "sale", label: "للبيع" },
  { id: "rent", label: "للإيجار" },
  { id: "wanted", label: "مطلوب" },
] as const;

export const CONDITIONS = [
  { id: "new", label: "جديد" },
  { id: "like_new", label: "كالجديد" },
  { id: "used", label: "مستعمل" },
  { id: "refurbished", label: "مجدد" },
] as const;

export type Intent = (typeof INTENTS)[number]["id"];
export type Condition = (typeof CONDITIONS)[number]["id"];
export type ListingStatus = "active" | "hidden" | "rejected" | "sold";

export type Category = {
  id: string;
  name: string;
  group: string;
  active: boolean;
};

export type ListingCard = {
  id: string;
  title: string;
  price: number | null;
  intent: Intent;
  condition: Condition;
  city: string;
  delivery: boolean;
  featured: boolean;
  status: ListingStatus;
  createdAt: string;
  categoryId: string;
  categoryName: string;
  cover: string | null;
  sellerName: string;
};

export type ListingDetail = ListingCard & {
  description: string;
  views: number;
  sellerId: string;
  hasPhone: boolean;
  images: string[];
};

export type MyProfile = {
  displayName: string;
  phone: string | null;
  city: string | null;
  role: "user" | "admin";
  banned: boolean;
  email: string | null;
  unread: number;
};

export type BrowseInput = {
  q: string;
  intent: "all" | Intent;
  category: string;
  city: string;
  condition: "all" | Condition;
  offset: number;
};

export function categoryName(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.name ?? "قسم";
}

export function intentLabel(id: string): string {
  return INTENTS.find((i) => i.id === id)?.label ?? id;
}

export function conditionLabel(id: string): string {
  return CONDITIONS.find((c) => c.id === id)?.label ?? id;
}

export function statusLabel(id: string): string {
  if (id === "active") return "منشور";
  if (id === "hidden") return "مخفي";
  if (id === "rejected") return "مرفوض";
  if (id === "sold") return "تم";
  return id;
}

export function formatPrice(price: number | null, intent: string): string {
  if (price == null) return intent === "wanted" ? "ميزانية مفتوحة" : "السعر عند التواصل";
  return `${new Intl.NumberFormat("ar-EG").format(price)} ج.م`;
}

export function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Date.now() - t) / 1000;
  if (s < 60) return "الآن";
  if (s < 3600) return `منذ ${Math.floor(s / 60)} د`;
  if (s < 86400) return `منذ ${Math.floor(s / 3600)} س`;
  const d = Math.floor(s / 86400);
  if (d < 30) return `منذ ${d} يوم`;
  return new Date(iso).toLocaleDateString("ar-EG");
}

export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes("@")) return null;
  let d = trimmed.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("00")) d = d.slice(2);
  if (/^01[0125]\d{8}$/.test(d)) d = `20${d.slice(1)}`;
  else if (/^1[0125]\d{8}$/.test(d)) d = `20${d}`;
  if (!/^\d{8,15}$/.test(d)) return null;
  if (d.startsWith("20") && !/^20(10|11|12|15)\d{8}$/.test(d)) return null;
  return `+${d}`;
}

export function identifierToLogin(raw: string): { email: string; phone: string | null } {
  const t = raw.trim();
  if (t.includes("@")) {
    const email = t.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("الإيميل مش صحيح");
    }
    if (email.endsWith(`@${PHONE_EMAIL_DOMAIN}`)) {
      throw new Error("اكتب رقم الموبايل نفسه من غير إيميل داخلي");
    }
    return { email, phone: null };
  }
  const phone = normalizePhone(t);
  if (!phone) throw new Error("اكتب إيميل صحيح أو رقم موبايل (مصري أو دولي يبدأ بـ +)");
  return { email: `p${phone.slice(1)}@${PHONE_EMAIL_DOMAIN}`, phone };
}

export function visibleEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  if (email.endsWith(`@${PHONE_EMAIL_DOMAIN}`)) return null;
  return email;
}

export function cleanText(input: string, max: number): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}

export const EMPTY_BROWSE: BrowseInput = {
  q: "",
  intent: "all",
  category: "",
  city: "",
  condition: "all",
  offset: 0,
};
