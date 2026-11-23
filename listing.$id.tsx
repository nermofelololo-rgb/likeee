import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Shell, useProfile } from "@/components/shell";
import { getListing, reportListing, revealPhone, sendMessage, toggleFavorite } from "@/lib/marketplace/api";
import { conditionLabel, formatPrice, intentLabel, statusLabel, timeAgo } from "@/lib/marketplace/shared";

export const Route = createFileRoute("/listing/$id")({
  component: ListingPage,
});

function ListingPage() {
  const { id } = Route.useParams();
  const { user, profile } = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listing = useQuery({ queryKey: ["listing", id], queryFn: () => getListing({ data: { id } }) });
  const [body, setBody] = useState("");
  const [reason, setReason] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [photo, setPhoto] = useState(0);
  const item = listing.data;

  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حصل خطأ");
    }
  }

  return (
    <Shell>
      {listing.isLoading ? <p className="text-sm text-muted">بنفتح الإعلان…</p> : null}
      {listing.data === null ? (
        <div className="rounded-3xl border border-line bg-card p-8 text-center">
          <h1 className="text-2xl font-bold">الإعلان مش متاح</h1>
          <p className="mt-2 text-sm text-muted">اتمسح أو اتخفى من الإدارة.</p>
          <Link to="/" className="mt-4 inline-flex h-11 items-center rounded-xl bg-green px-4 font-bold text-on-green">
            الرجوع للسوق
          </Link>
        </div>
      ) : null}
      {item ? (
        <article className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div>
            <div className="overflow-hidden rounded-3xl border border-line bg-green-soft">
              {item.images[photo] ? (
                <img src={item.images[photo]} alt="" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="grid aspect-[4/3] place-items-center text-sm font-semibold text-green">{item.categoryName}</div>
              )}
            </div>
            {item.images.length > 1 ? (
              <div className="mt-2 flex gap-2">
                {item.images.map((src, i) => (
                  <button key={i} type="button" onClick={() => setPhoto(i)} className="h-16 w-16 overflow-hidden rounded-xl border border-line">
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="space-y-4">
            <p className="text-sm font-semibold text-green">
              {intentLabel(item.intent)} · {item.categoryName}
              {item.status === "sold" ? ` · ${statusLabel(item.status)}` : ""}
            </p>
            <h1 className="text-3xl font-bold">{item.title}</h1>
            <p className="text-2xl font-bold tabular-nums text-amber">{formatPrice(item.price, item.intent)}</p>
            <p className="text-sm text-muted">
              {item.city} · {conditionLabel(item.condition)} · {item.delivery ? "توصيل متاح" : "بدون توصيل"} · {timeAgo(item.createdAt)} · {item.views} مشاهدة
            </p>
            <p className="whitespace-pre-wrap text-sm leading-7">{item.description}</p>
            <div className="rounded-2xl border border-line bg-card p-4">
              <p className="text-sm text-muted">البائع</p>
              <p className="font-bold">{item.sellerName}</p>
              {user && user.id !== item.sellerId ? (
                <div className="mt-3 space-y-2">
                  {item.hasPhone ? (
                    phone ? (
                      <a href={`tel:${phone}`} className="block text-lg font-bold tabular-nums text-green">{phone}</a>
                    ) : (
                      <button
                        type="button"
                        className="h-11 rounded-xl border border-line px-4 text-sm font-bold"
                        onClick={() =>
                          void act(async () => {
                            const res = await revealPhone({ data: { id: item.id } });
                            setPhone(res.phone ?? "مفيش رقم محفوظ");
                          }, "الرقم ظهر")
                        }
                      >
                        إظهار الرقم
                      </button>
                    )
                  ) : (
                    <p className="text-sm text-muted">البائع مخبي الرقم. راسله من هنا.</p>
                  )}
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="اكتب رسالتك للبائع"
                    className="min-h-24 w-full rounded-xl border border-line bg-paper p-3"
                  />
                  <button
                    type="button"
                    className="h-11 w-full rounded-xl bg-green text-sm font-bold text-on-green"
                    onClick={() =>
                      void act(async () => {
                        const res = await sendMessage({ data: { listingId: item.id, body } });
                        setBody("");
                        await qc.invalidateQueries({ queryKey: ["profile"] });
                        void navigate({ to: "/inbox/$threadId", params: { threadId: res.threadId } });
                      }, "الرسالة اتبعتت")
                    }
                  >
                    مراسلة
                  </button>
                  <button
                    type="button"
                    className="h-11 w-full rounded-xl border border-line text-sm font-semibold"
                    onClick={() =>
                      void act(async () => {
                        await toggleFavorite({ data: { id: item.id } });
                        await qc.invalidateQueries({ queryKey: ["favs"] });
                      }, "المفضلة اتحدثت")
                    }
                  >
                    حفظ في المفضلة
                  </button>
                </div>
              ) : user && user.id === item.sellerId ? (
                <Link to="/post" search={{ edit: item.id }} className="mt-3 inline-flex h-11 items-center rounded-xl bg-ink px-4 text-sm font-bold text-paper">
                  تعديل إعلاني
                </Link>
              ) : (
                <Link to="/login" className="mt-3 inline-flex h-11 items-center rounded-xl bg-green px-4 text-sm font-bold text-on-green">
                  ادخل عشان تراسل
                </Link>
              )}
            </div>
            {user && user.id !== item.sellerId ? (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(async () => {
                    await reportListing({ data: { id: item.id, reason } });
                    setReason("");
                  }, "البلاغ وصل للإدارة");
                }}
              >
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="سبب البلاغ"
                  className="h-11 w-full rounded-xl border border-line bg-card px-3"
                />
                <button type="submit" className="text-sm font-semibold text-muted">
                  إبلاغ عن الإعلان
                </button>
              </form>
            ) : null}
            {profile?.role === "admin" ? (
              <Link to="/admin" className="inline-flex text-sm font-bold text-green">مراجعة من لوحة الأدمن</Link>
            ) : null}
          </div>
        </article>
      ) : null}
    </Shell>
  );
}
