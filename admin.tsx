import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Shell, controlClass, useProfile } from "@/components/shell";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { adminAct, adminListings, adminOverview, adminReports, adminUsers, listCategories } from "@/lib/marketplace/api";
import { formatPrice, intentLabel, statusLabel, timeAgo } from "@/lib/marketplace/shared";

export const Route = createFileRoute("/admin")({ component: AdminPage });

type Tab = "overview" | "listings" | "users" | "reports" | "sections";

function AdminPage() {
  const { user, isPending, profile, profileLoading } = useProfile();
  const [tab, setTab] = useState<Tab>("overview");
  if (isPending || profileLoading) return <Shell><p className="text-sm text-muted">بنراجع الصلاحية…</p></Shell>;
  if (!user) return <RedirectToSignIn />;
  if (profile?.role !== "admin") {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">اللوحة دي للأدمن</h1>
        <p className="mt-2 text-sm text-muted">حسابك عضو عادي. الأدمن الأساسيين بيتفعّلوا أول ما يسجلوا بالإيميلات المعتمدة.</p>
      </Shell>
    );
  }
  return (
    <Shell>
      <h1 className="text-3xl font-bold">لوحة Like New</h1>
      <p className="mt-1 text-sm text-muted">إدارة الإعلانات والمستخدمين والبلاغات. كل أمر بيتنفذ من السيرفر بعد التأكد إنك أدمن.</p>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {(
          [
            ["overview", "نظرة"],
            ["listings", "الإعلانات"],
            ["users", "المستخدمين"],
            ["reports", "البلاغات"],
            ["sections", "الأقسام"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`h-10 shrink-0 rounded-full px-4 text-sm font-bold ${tab === id ? "bg-ink text-paper" : "border border-line bg-card"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "overview" ? <Overview /> : null}
      {tab === "listings" ? <ListingsMod /> : null}
      {tab === "users" ? <UsersMod /> : null}
      {tab === "reports" ? <ReportsMod /> : null}
      {tab === "sections" ? <SectionsMod /> : null}
    </Shell>
  );
}

function useAct() {
  const qc = useQueryClient();
  return async (data: unknown, ok: string) => {
    try {
      await adminAct({ data });
      toast.success(ok);
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "الأمر ما اتنفذش");
    }
  };
}

function Overview() {
  const data = useQuery({ queryKey: ["admin-overview"], queryFn: () => adminOverview() });
  const s = data.data;
  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          ["إعلانات", s?.listings],
          ["منشور", s?.active],
          ["مرفوض", s?.rejected],
          ["مستخدمين", s?.users],
          ["أدمن", s?.admins],
          ["بلاغات مفتوحة", s?.reports],
        ].map(([label, n]) => (
          <div key={String(label)} className="rounded-2xl border border-line bg-card p-4">
            <p className="text-xs font-semibold text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{n ?? "—"}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-line bg-card p-4">
        <h2 className="font-bold">آخر حركات الإدارة</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(s?.log ?? []).length === 0 ? <li className="text-muted">لسه مفيش حركات.</li> : null}
          {(s?.log ?? []).map((row, i) => (
            <li key={i} className="flex justify-between gap-3 border-b border-line pb-2">
              <span>{row.name}: {row.action}</span>
              <span className="text-muted">{timeAgo(row.createdAt)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ListingsMod() {
  const act = useAct();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [draft, setDraft] = useState("");
  const rows = useQuery({
    queryKey: ["admin-listings", q, status],
    queryFn: () => adminListings({ data: { q, status } }),
  });
  return (
    <div className="mt-4 space-y-3">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setQ(draft); }}>
        <input className={controlClass} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="عنوان أو إيميل" />
        <button className="h-12 rounded-xl bg-ink px-4 text-sm font-bold text-paper" type="submit">بحث</button>
      </form>
      <select className={controlClass} value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="all">كل الحالات</option>
        <option value="active">منشور</option>
        <option value="hidden">مخفي</option>
        <option value="rejected">مرفوض</option>
        <option value="sold">تم</option>
      </select>
      <div className="space-y-2">
        {(rows.data ?? []).map((row) => (
          <article key={row.id} className="rounded-2xl border border-line bg-card p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-bold">{row.title}</h3>
                <p className="text-sm text-muted">
                  {row.seller} · {row.email} · {row.city} · {intentLabel(row.intent)} · {formatPrice(row.price, row.intent)}
                </p>
                <p className="text-xs text-muted">{statusLabel(row.status)}{row.featured ? " · مميز" : ""} · {timeAgo(row.createdAt)}</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Mini onClick={() => void act({ type: "listing", id: row.id, action: row.featured ? "unfeature" : "feature" }, "تم")}>{row.featured ? "إلغاء التمييز" : "تمييز"}</Mini>
              <Mini onClick={() => void act({ type: "listing", id: row.id, action: "hide" }, "اتخفى")}>إخفاء</Mini>
              <Mini onClick={() => void act({ type: "listing", id: row.id, action: "restore" }, "اتنشر")}>نشر</Mini>
              <Mini onClick={() => void act({ type: "listing", id: row.id, action: "reject" }, "اترفض")}>رفض</Mini>
              <Mini onClick={() => void act({ type: "listing", id: row.id, action: "delete" }, "اتمسح")}>حذف</Mini>
            </div>
          </article>
        ))}
        {rows.data && rows.data.length === 0 ? <p className="text-sm text-muted">مفيش إعلانات.</p> : null}
      </div>
    </div>
  );
}

function UsersMod() {
  const act = useAct();
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [grant, setGrant] = useState("");
  const rows = useQuery({ queryKey: ["admin-users", q], queryFn: () => adminUsers({ data: { q } }) });
  return (
    <div className="mt-4 space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void act({ type: "grant", identifier: grant }, "اتضاف كأدمن. لو لسه مسجلش، هياخد الصلاحية أول ما يعمل حساب.");
          setGrant("");
        }}
      >
        <input className={controlClass} value={grant} onChange={(e) => setGrant(e.target.value)} placeholder="رقّي أدمن: إيميل أو موبايل" />
        <button className="h-12 shrink-0 rounded-xl bg-green px-4 text-sm font-bold text-on-green" type="submit">ترقية</button>
      </form>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setQ(draft); }}>
        <input className={controlClass} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="دور بإيميل أو اسم أو رقم" />
        <button className="h-12 rounded-xl bg-ink px-4 text-sm font-bold text-paper" type="submit">بحث</button>
      </form>
      <div className="space-y-2">
        {(rows.data ?? []).map((row) => (
          <article key={row.id} className="rounded-2xl border border-line bg-card p-3">
            <h3 className="font-bold">{row.name} {row.role === "admin" ? "· أدمن" : ""} {row.banned ? "· موقوف" : ""} {row.seed ? "· أساسي" : ""}</h3>
            <p className="text-sm text-muted">{row.email}{row.phone ? ` · ${row.phone}` : ""} · {row.listings} إعلان</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {row.role === "admin" ? (
                <Mini onClick={() => void act({ type: "user", id: row.id, action: "demote" }, "اتبقت عضو")}>إلغاء الأدمن</Mini>
              ) : (
                <Mini onClick={() => void act({ type: "user", id: row.id, action: "promote" }, "بقى أدمن")}>ترقية</Mini>
              )}
              {row.banned ? (
                <Mini onClick={() => void act({ type: "user", id: row.id, action: "unban" }, "الحساب رجع")}>فك الإيقاف</Mini>
              ) : (
                <Mini onClick={() => void act({ type: "user", id: row.id, action: "ban" }, "الحساب اتقف")}>إيقاف</Mini>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ReportsMod() {
  const act = useAct();
  const rows = useQuery({ queryKey: ["admin-reports"], queryFn: () => adminReports() });
  return (
    <div className="mt-4 space-y-2">
      {(rows.data ?? []).map((row) => (
        <article key={row.id} className="rounded-2xl border border-line bg-card p-3">
          <h3 className="font-bold">{row.title}</h3>
          <p className="text-sm">{row.reason}</p>
          <p className="text-xs text-muted">{row.reporter} · {row.status === "open" ? "مفتوح" : "مقفول"} · {timeAgo(row.createdAt)}</p>
          {row.status === "open" ? (
            <div className="mt-2 flex gap-2">
              <Mini onClick={() => void act({ type: "report", id: row.id, action: "dismiss" }, "البلاغ اتقفل")}>تجاهل</Mini>
              <Mini onClick={() => void act({ type: "report", id: row.id, action: "reject-listing" }, "الإعلان اترفض")}>رفض الإعلان</Mini>
            </div>
          ) : null}
        </article>
      ))}
      {rows.data && rows.data.length === 0 ? <p className="text-sm text-muted">مفيش بلاغات.</p> : null}
    </div>
  );
}

function SectionsMod() {
  const act = useAct();
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {(cats.data ?? []).map((c) => (
        <div key={c.id} className="flex items-center justify-between rounded-2xl border border-line bg-card px-3 py-3">
          <div>
            <p className="font-bold">{c.name}</p>
            <p className="text-xs text-muted">{c.group} · {c.active ? "ظاهر" : "متوقف"}</p>
          </div>
          <Mini onClick={() => void act({ type: "category", id: c.id, active: !c.active }, "القسم اتحدث")}>
            {c.active ? "إيقاف" : "تشغيل"}
          </Mini>
        </div>
      ))}
    </div>
  );
}

function Mini({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="h-9 rounded-xl border border-line bg-paper px-3 text-xs font-bold">
      {children}
    </button>
  );
}
