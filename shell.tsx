import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, Home, MessageCircle, Plus, Shield, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { SignedOut } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyProfile } from "@/lib/marketplace/api";

export function useProfile() {
  const { user, isPending } = useCurrentUserState();
  const query = useQuery({
    queryKey: ["profile", user?.id ?? "anon"],
    enabled: Boolean(user) && !isPending,
    queryFn: () => getMyProfile(),
  });
  return { user, isPending, profile: query.data ?? null, profileLoading: Boolean(user) && query.isLoading };
}

const NAV = [
  { to: "/", label: "الرئيسية", icon: Home },
  { to: "/post", label: "أضف", icon: Plus },
  { to: "/inbox", label: "الرسائل", icon: MessageCircle },
  { to: "/account", label: "حسابي", icon: UserRound },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const { user, isPending, profile } = useProfile();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-green text-sm font-bold text-on-green">
              LN
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-bold leading-none tracking-tight">Like New</span>
              <span className="mt-1 block truncate text-xs text-muted">سوق كل أقسام الطب</span>
            </span>
          </Link>
          <div className="ms-auto flex items-center gap-2">
            {profile?.role === "admin" ? (
              <Link
                to="/admin"
                className="hidden h-10 items-center gap-1 rounded-xl border border-line bg-card px-3 text-sm font-semibold sm:inline-flex"
              >
                <Shield className="size-4" />
                الأدمن
              </Link>
            ) : null}
            <Link
              to="/post"
              className="inline-flex h-10 items-center gap-1 rounded-xl bg-green px-3 text-sm font-semibold text-on-green"
            >
              <Plus className="size-4" />
              أضف إعلان
            </Link>
            {isPending ? (
              <span className="h-10 w-16 animate-pulse rounded-xl bg-line" />
            ) : user ? (
              <Link to="/account" className="hidden max-w-36 truncate text-sm font-semibold sm:block">
                {profile?.displayName ?? user.displayName ?? "حسابي"}
              </Link>
            ) : (
              <SignedOut>
                <Link to="/login" className="inline-flex h-10 items-center rounded-xl border border-line bg-card px-3 text-sm font-semibold">
                  دخول
                </Link>
              </SignedOut>
            )}
          </div>
        </div>
      </header>
      {profile?.banned ? (
        <div className="bg-amber-soft px-4 py-2 text-center text-sm text-amber">الحساب موقوف. تقدر تتصفح بس مش هتقدر تنشر.</div>
      ) : null}
      <main className="mx-auto w-full max-w-6xl px-4 pt-5 pb-28">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card">
        <div className="mx-auto grid max-w-6xl grid-cols-4">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-semibold ${active ? "text-green" : "text-muted"}`}
              >
                <Icon className="size-5" />
                {item.label}
                {item.to === "/inbox" && profile && profile.unread > 0 ? (
                  <span className="absolute top-2 ms-6 rounded-full bg-amber px-1.5 text-xs text-on-green tabular-nums">
                    {profile.unread}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

export const controlClass =
  "h-12 w-full rounded-xl border border-line bg-card px-3 outline-none";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-card px-6 py-14 text-center">
      <Heart className="mx-auto size-8 text-green" />
      <h2 className="mt-3 text-xl font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
