import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, Shell, controlClass, useProfile } from "@/components/shell";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { createListing, getOwnedListing, listCategories, updateListing } from "@/lib/marketplace/api";
import { compressFile, shrinkDataUrl } from "@/lib/marketplace/images";
import { CITIES, CONDITIONS, INTENTS } from "@/lib/marketplace/shared";

export const Route = createFileRoute("/post")({
  validateSearch: (search: Record<string, unknown>): { edit?: string } =>
    typeof search.edit === "string" && search.edit ? { edit: search.edit.slice(0, 80) } : {},
  component: PostPage,
});

function PostPage() {
  const { user, isPending, profile } = useProfile();
  const { edit = "" } = Route.useSearch();
  if (isPending) return <Shell><p className="text-sm text-muted">بنجهز الحساب…</p></Shell>;
  if (!user) return <RedirectToSignIn />;
  return <Composer key={edit || "new"} edit={edit} banned={Boolean(profile?.banned)} />;
}

function Composer({ edit, banned }: { edit: string; banned: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const existing = useQuery({
    queryKey: ["owned", edit],
    enabled: Boolean(edit),
    queryFn: () => getOwnedListing({ data: { id: edit } }),
  });
  const [categoryId, setCategoryId] = useState("devices");
  const [intent, setIntent] = useState<"sale" | "rent" | "wanted">("sale");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState<"new" | "like_new" | "used" | "refurbished">("like_new");
  const [city, setCity] = useState("القاهرة");
  const [delivery, setDelivery] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(!edit);

  useEffect(() => {
    const row = existing.data;
    if (!row) return;
    setCategoryId(row.categoryId);
    setIntent(row.intent);
    setTitle(row.title);
    setDescription(row.description);
    setPrice(row.price == null ? "" : String(row.price));
    setCondition(row.condition);
    setCity(row.city);
    setDelivery(row.delivery);
    setImages(row.images);
    setReady(true);
  }, [existing.data]);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...images];
    try {
      for (const file of Array.from(list)) {
        if (next.length >= 4) break;
        next.push(await compressFile(file, 1280, 180_000));
      }
      setImages(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "الصورة ما اترفعتش");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (banned) {
      toast.error("الحساب موقوف");
      return;
    }
    setBusy(true);
    try {
      const cover = images[0] ? await shrinkDataUrl(images[0], 480, 50_000) : null;
      const payload = {
        categoryId,
        intent,
        title,
        description,
        price: price.trim() ? Number(price) : null,
        condition,
        city,
        delivery,
        images,
        cover,
        company,
      };
      const saved = edit
        ? await updateListing({ data: { ...payload, id: edit } })
        : await createListing({ data: payload });
      await qc.invalidateQueries({ queryKey: ["listings"] });
      await qc.invalidateQueries({ queryKey: ["mine"] });
      toast.success(edit ? "الإعلان اتحدث" : "الإعلان اتنشر");
      void navigate({ to: "/listing/$id", params: { id: saved.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "النشر متعذر");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <h1 className="text-3xl font-bold">{edit ? "تعديل الإعلان" : "إعلان جديد"}</h1>
      <p className="mt-2 text-sm text-muted">يظهر فورًا في القسم اللي تختاره. الأدمن يقدر يميّزه أو يخفيه.</p>
      {edit && existing.isFetched && !existing.data ? (
        <p className="mt-6 text-sm">الإعلان مش موجود أو مش بتاعك.</p>
      ) : null}
      {ready ? (
        <form onSubmit={(e) => void submit(e)} className="mt-6 grid gap-4 lg:grid-cols-2">
          <label className="absolute h-px w-px overflow-hidden" aria-hidden="true">
            موقع الشركة
            <input tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
          </label>
          <Field label="القسم">
            <select className={controlClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {(categories.data ?? []).filter((c) => c.active).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.group} — {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="نوع الإعلان">
            <select className={controlClass} value={intent} onChange={(e) => setIntent(e.target.value as typeof intent)}>
              {INTENTS.map((i) => (
                <option key={i.id} value={i.id}>{i.label}</option>
              ))}
            </select>
          </Field>
          <div className="lg:col-span-2">
            <Field label="العنوان">
              <input className={controlClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required />
            </Field>
          </div>
          <div className="lg:col-span-2">
            <Field label="الوصف">
              <textarea
                className="min-h-36 w-full rounded-xl border border-line bg-card p-3 outline-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={4000}
                required
              />
            </Field>
          </div>
          <Field label={intent === "wanted" ? "الميزانية (اختياري)" : "السعر بالجنيه (اختياري)"}>
            <input
              className={`${controlClass} tabular-nums`}
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="فاضي يعني عند التواصل"
            />
          </Field>
          <Field label="الحالة">
            <select className={controlClass} value={condition} onChange={(e) => setCondition(e.target.value as typeof condition)}>
              {CONDITIONS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="المحافظة">
            <select className={controlClass} value={city} onChange={(e) => setCity(e.target.value)}>
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <label className="flex h-12 items-center gap-2 self-end text-sm font-semibold">
            <input type="checkbox" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} />
            التوصيل متاح
          </label>
          <div className="lg:col-span-2">
            <Field label="صور (حد أقصى ٤)">
              <input type="file" accept="image/*" multiple onChange={(e) => void addFiles(e.target.files)} />
            </Field>
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((src, i) => (
                <div key={src.slice(0, 32) + i} className="relative h-24 w-24 shrink-0">
                  <img src={src} alt="" className="h-24 w-24 rounded-xl object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                    className="absolute top-1 end-1 rounded-full bg-ink px-2 text-xs text-paper"
                  >
                    حذف
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={busy || banned}
            className="h-12 rounded-xl bg-green text-sm font-bold text-on-green disabled:opacity-60 lg:col-span-2"
          >
            {busy ? "بيتنشر…" : edit ? "حفظ التعديل" : "نشر الإعلان"}
          </button>
        </form>
      ) : null}
    </Shell>
  );
}
