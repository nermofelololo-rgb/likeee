import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Armchair,
  Baby,
  Bone,
  Brain,
  Ear,
  Eye,
  FlaskConical,
  HeartPulse,
  Microscope,
  Package,
  PawPrint,
  Pill,
  Scan,
  Sparkles,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { ListingCardView } from "@/components/listing-card";
import { EmptyState, Shell, controlClass } from "@/components/shell";
import { listCategories, listListings } from "@/lib/marketplace/api";
import { CITIES, CONDITIONS, INTENTS, type BrowseInput } from "@/lib/marketplace/shared";

const ICONS: Record<string, LucideIcon> = {
  dental: Stethoscope,
  internal: Stethoscope,
  surgery: Activity,
  cardio: HeartPulse,
  ortho: Bone,
  eyes: Eye,
  ent: Ear,
  peds: Baby,
  obgyn: Sparkles,
  derma: Sparkles,
  radio: Scan,
  lab: FlaskConical,
  anesth: Syringe,
  neuro: Brain,
  uro: Activity,
  onco: Microscope,
  psych: Brain,
  physio: Activity,
  pharmacy: Pill,
  nursing: Stethoscope,
  vet: PawPrint,
  devices: Package,
  consumables: FlaskConical,
  furniture: Armchair,
  other: Package,
};

type Search = {
  q?: string;
  intent?: "sale" | "rent" | "wanted";
  category?: string;
  city?: string;
  condition?: "new" | "like_new" | "used" | "refurbished";
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof search.q === "string" && search.q) out.q = search.q.slice(0, 80);
    if (search.intent === "sale" || search.intent === "rent" || search.intent === "wanted") out.intent = search.intent;
    if (typeof search.category === "string" && search.category) out.category = search.category.slice(0, 40);
    if (typeof search.city === "string" && search.city) out.city = search.city.slice(0, 40);
    if (
      search.condition === "new" ||
      search.condition === "like_new" ||
      search.condition === "used" ||
      search.condition === "refurbished"
    ) {
      out.condition = search.condition;
    }
    return out;
  },
  component: Home,
});

function Home() {
  const raw = Route.useSearch();
  const search: BrowseInput = {
    q: raw.q ?? "",
    intent: raw.intent ?? "all",
    category: raw.category ?? "",
    city: raw.city ?? "",
    condition: raw.condition ?? "all",
    offset: 0,
  };
  const navigate = useNavigate({ from: "/" });
  const [draft, setDraft] = useState(search.q);
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const listings = useQuery({
    queryKey: ["listings", search],
    queryFn: () => listListings({ data: search }),
  });
  const set = (patch: Partial<BrowseInput>) => {
    const next = { ...search, ...patch };
    void navigate({
      search: {
        q: next.q || undefined,
        intent: next.intent === "all" ? undefined : next.intent,
        category: next.category || undefined,
        city: next.city || undefined,
        condition: next.condition === "all" ? undefined : next.condition,
      },
    });
  };
  const activeCats = (categories.data ?? []).filter((c) => c.active);
  const groups = ["التخصصات", "التجهيزات"];
  const filtering = Boolean(search.q || search.category || search.city || search.intent !== "all" || search.condition !== "all");

  return (
    <Shell>
      <section className="mb-6 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-green">مصر · كل التخصصات الطبية</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">ساحة الأجهزة والمستلزمات</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            بيع، إيجار، أو اطلب جهاز. السوق فاضي عمدًا — مفيش إعلانات منقولة، أول إعلان هيكون إعلانك.
          </p>
        </div>
        <ol className="grid grid-cols-3 gap-2 text-center text-xs font-semibold sm:max-w-sm">
          {["سجّل بإيميل أو موبايل", "انشر في قسمك", "راسل أو أظهر الرقم"].map((step, i) => (
            <li key={step} className="rounded-2xl border border-line bg-card px-2 py-3">
              <span className="mb-1 block text-green tabular-nums">0{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          set({ q: draft });
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="دور على جهاز، مادة، أو قسم"
          className={controlClass}
        />
        <button type="submit" className="h-12 shrink-0 rounded-xl bg-ink px-4 text-sm font-bold text-paper">
          بحث
        </button>
      </form>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <FilterChip active={search.intent === "all"} onClick={() => set({ intent: "all" })}>
          الكل
        </FilterChip>
        {INTENTS.map((item) => (
          <FilterChip key={item.id} active={search.intent === item.id} onClick={() => set({ intent: item.id })}>
            {item.label}
          </FilterChip>
        ))}
      </div>

      <div className="mb-6 space-y-3">
        {groups.map((group) => (
          <div key={group}>
            <p className="mb-2 text-xs font-bold text-muted">{group}</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {activeCats
                .filter((c) => c.group === group)
                .map((c) => {
                  const Icon = ICONS[c.id] ?? Package;
                  const on = search.category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => set({ category: on ? "" : c.id })}
                      className={`flex h-16 w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border text-xs font-semibold ${on ? "border-green bg-green text-on-green" : "border-line bg-card"}`}
                    >
                      <Icon className="size-4" />
                      <span className="line-clamp-2 px-1 leading-4">{c.name}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-5 grid gap-2 sm:grid-cols-3">
        <select className={controlClass} value={search.city} onChange={(e) => set({ city: e.target.value })}>
          <option value="">كل المحافظات</option>
          {CITIES.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
        <select
          className={controlClass}
          value={search.condition}
          onChange={(e) => set({ condition: e.target.value as BrowseInput["condition"] })}
        >
          <option value="all">كل الحالات</option>
          {CONDITIONS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!filtering}
          onClick={() => {
            setDraft("");
            set({ q: "", intent: "all", category: "", city: "", condition: "all" });
          }}
          className="h-12 rounded-xl border border-line bg-card text-sm font-semibold disabled:opacity-40"
        >
          مسح الفلاتر
        </button>
      </div>

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">الإعلانات</h2>
        <span className="text-sm tabular-nums text-muted">{listings.data ? `${listings.data.total} إعلان` : ""}</span>
      </div>

      {listings.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-3xl bg-line" />
          ))}
        </div>
      ) : listings.isError ? (
        <EmptyState title="متعذر تحميل الإعلانات" body="حصل خطأ مؤقت. حدّث الصفحة وحاول تاني." />
      ) : listings.data && listings.data.items.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {listings.data.items.map((item) => (
            <ListingCardView key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={filtering ? "مفيش نتائج بالفلتر ده" : "السوق فاضي"}
          body={
            filtering
              ? "جرّب قسم تاني أو امسح الفلاتر. لسه مفيش إعلانات متخزنة من أي موقع تاني."
              : "مفيش أجهزة ولا مستلزمات متعبّية مسبقًا. انشر إعلانك في قسمك: أسنان، قلب، أشعة، معمل، أو أي تخصص."
          }
          action={
            <Link to="/post" className="inline-flex h-12 items-center rounded-xl bg-green px-5 font-bold text-on-green">
              أضف أول إعلان
            </Link>
          }
        />
      )}
    </Shell>
  );
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 shrink-0 rounded-full px-4 text-sm font-bold ${active ? "bg-ink text-paper" : "border border-line bg-card"}`}
    >
      {children}
    </button>
  );
}
