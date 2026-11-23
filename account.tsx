import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ListingCardView } from "@/components/listing-card";
import { EmptyState, Field, Shell, controlClass, useProfile } from "@/components/shell";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { signOut } from "@/lib/auth/client";
import { deleteOwnListing, favoriteListings, myListings, setOwnStatus, updateProfile } from "@/lib/marketplace/api";
import { CITIES, statusLabel } from "@/lib/marketplace/shared";

export const Route = createFileRoute("/account")({ component: AccountPage });

function AccountPage() {
  const { user, isPending, profile } = useProfile();
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ["mine", user?.id], enabled: Boolean(user), queryFn: () => myListings() });
  const favs = useQuery({ queryKey: ["favs", user?.id], enabled: Boolean(user), queryFn: () => favoriteListings() });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [tab, setTab] = useState<"ads" | "fav">("ads");

  useEffect(() => {
    if (!profile) return;
    setName(profile.displayName);
    setPhone(profile.phone ?? "");
    setCity(profile.city ?? "");
  }, [profile]);

  if (isPending) return <Shell><p className="text-sm text-muted">بنجهز الحساب…</p></Shell>;
  if (!user) return <RedirectToSignIn />;

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{profile?.displayName ?? "حسابي"}</h1>
          <p className="mt-1 text-sm text-muted">
            {profile?.role === "admin" ? "أنت أدمن" : "عضو"}
            {profile?.email ? ` · ${profile.email}` : " · دخول برقم الموبايل"}
          </p>
        </div>
        <div className="flex gap-2">
          {profile?.role === "admin" ? (
            <Link to="/admin" className="inline-flex h-11 items-center rounded-xl bg-ink px-4 text-sm font-bold text-paper">
              لوحة الأدمن
            </Link>
          ) : null}
          <button
            type="button"
            className="h-11 rounded-xl border border-line bg-card px-4 text-sm font-semibold"
            onClick={() => void signOut()}
          >
            خروج
          </button>
        </div>
      </div>

      <form
        className="mb-8 grid gap-3 rounded-3xl border border-line bg-card p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void updateProfile({ data: { displayName: name, phone, city } })
            .then(async () => {
              toast.success("البيانات اتحفظت");
              await qc.invalidateQueries({ queryKey: ["profile"] });
            })
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "متعذر الحفظ"));
        }}
      >
        <Field label="الاسم">
          <input className={controlClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="الموبايل">
          <input className={controlClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="اختياري" />
        </Field>
        <Field label="المحافظة">
          <select className={controlClass} value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">غير محدد</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <div className="self-end">
          <button type="submit" className="h-12 w-full rounded-xl bg-green font-bold text-on-green">حفظ</button>
        </div>
      </form>

      <div className="mb-4 flex gap-2">
        <button type="button" onClick={() => setTab("ads")} className={`h-10 rounded-full px-4 text-sm font-bold ${tab === "ads" ? "bg-ink text-paper" : "border border-line bg-card"}`}>
          إعلاناتي
        </button>
        <button type="button" onClick={() => setTab("fav")} className={`h-10 rounded-full px-4 text-sm font-bold ${tab === "fav" ? "bg-ink text-paper" : "border border-line bg-card"}`}>
          المفضلة
        </button>
      </div>

      {tab === "ads" ? (
        mine.data && mine.data.length > 0 ? (
          <div className="space-y-4">
            {mine.data.map((item) => (
              <div key={item.id} className="grid gap-3 rounded-3xl border border-line bg-card p-3 sm:grid-cols-[16rem_1fr]">
                <ListingCardView item={item} />
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-bold">الحالة: {statusLabel(item.status)}{item.featured ? " · مميز" : ""}</p>
                  <div className="flex flex-wrap gap-2">
                    <Link to="/post" search={{ edit: item.id }} className="inline-flex h-10 items-center rounded-xl border border-line px-3 text-sm font-semibold">تعديل</Link>
                    {item.status !== "rejected" ? (
                      <>
                        <button type="button" className="h-10 rounded-xl border border-line px-3 text-sm" onClick={() => void setOwnStatus({ data: { id: item.id, status: item.status === "hidden" ? "active" : "hidden" } }).then(() => qc.invalidateQueries({ queryKey: ["mine"] }))}>
                          {item.status === "hidden" ? "نشر" : "إخفاء"}
                        </button>
                        <button type="button" className="h-10 rounded-xl border border-line px-3 text-sm" onClick={() => void setOwnStatus({ data: { id: item.id, status: "sold" } }).then(() => qc.invalidateQueries({ queryKey: ["mine"] }))}>
                          تم البيع / التأجير
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="h-10 rounded-xl border border-line px-3 text-sm font-semibold"
                      onClick={() => {
                        if (!confirm("مسح الإعلان؟")) return;
                        void deleteOwnListing({ data: { id: item.id } }).then(() => qc.invalidateQueries({ queryKey: ["mine"] }));
                      }}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="لسه منزلتش إعلان" body="إعلاناتك هتظهر هنا بعد النشر." action={<Link to="/post" className="inline-flex h-11 items-center rounded-xl bg-green px-4 font-bold text-on-green">أضف إعلان</Link>} />
        )
      ) : favs.data && favs.data.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {favs.data.map((item) => <ListingCardView key={item.id} item={item} />)}
        </div>
      ) : (
        <EmptyState title="المفضلة فاضية" body="احفظ الإعلانات اللي عاجباك من صفحة الإعلان." />
      )}

      <div className="mt-10 text-sm text-muted">
        <UserButton />
      </div>
    </Shell>
  );
}
