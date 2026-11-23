import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState, Shell, useProfile } from "@/components/shell";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { myThreads } from "@/lib/marketplace/api";
import { timeAgo } from "@/lib/marketplace/shared";

export const Route = createFileRoute("/inbox")({ component: InboxPage });

function InboxPage() {
  const { user, isPending } = useProfile();
  const threads = useQuery({
    queryKey: ["threads", user?.id],
    enabled: Boolean(user),
    queryFn: () => myThreads(),
  });
  if (isPending) return <Shell><p className="text-sm text-muted">بنجهز الرسائل…</p></Shell>;
  if (!user) return <RedirectToSignIn />;
  return (
    <Shell>
      <h1 className="mb-4 text-3xl font-bold">الرسائل</h1>
      {threads.data && threads.data.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-card">
          {threads.data.map((t) => (
            <li key={t.id}>
              <Link to="/inbox/$threadId" params={{ threadId: t.id }} className="flex items-center gap-3 px-4 py-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-green-soft">
                  {t.cover ? <img src={t.cover} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-bold">{t.otherName}</p>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(t.updatedAt)}</span>
                  </div>
                  <p className="truncate text-sm text-muted">{t.listingTitle}</p>
                  <p className="truncate text-sm">{t.lastBody}</p>
                </div>
                {t.unread > 0 ? (
                  <span className="rounded-full bg-amber px-2 text-xs font-bold text-on-green tabular-nums">{t.unread}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="مفيش محادثات" body="لما تراسل بائع من صفحة إعلان، الكلام هيظهر هنا." />
      )}
    </Shell>
  );
}
