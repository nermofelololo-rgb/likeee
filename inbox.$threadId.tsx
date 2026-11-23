import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Shell, useProfile } from "@/components/shell";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { getThread, replyMessage } from "@/lib/marketplace/api";
import { timeAgo } from "@/lib/marketplace/shared";

export const Route = createFileRoute("/inbox/$threadId")({ component: ThreadPage });

function ThreadPage() {
  const { threadId } = Route.useParams();
  const { user, isPending } = useProfile();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const thread = useQuery({
    queryKey: ["thread", threadId],
    enabled: Boolean(user),
    queryFn: () => getThread({ data: { id: threadId } }),
    refetchInterval: 8000,
  });
  if (isPending) return <Shell><p className="text-sm text-muted">بنفتح المحادثة…</p></Shell>;
  if (!user) return <RedirectToSignIn />;
  const data = thread.data;
  return (
    <Shell>
      <Link to="/inbox" className="text-sm font-semibold text-green">كل الرسائل</Link>
      {!data && !thread.isLoading ? <p className="mt-6">المحادثة مش موجودة.</p> : null}
      {data ? (
        <div className="mt-3">
          <h1 className="text-2xl font-bold">{data.otherName}</h1>
          <Link to="/listing/$id" params={{ id: data.listingId }} className="text-sm text-muted">{data.listingTitle}</Link>
          <div className="mt-4 space-y-2">
            {data.messages.map((m) => (
              <div key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-6 ${m.mine ? "ms-auto bg-green text-on-green" : "bg-card border border-line"}`}>
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={`mt-1 text-xs ${m.mine ? "text-on-green/80" : "text-muted"}`}>{timeAgo(m.createdAt)}</p>
              </div>
            ))}
          </div>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void replyMessage({ data: { threadId, body } })
                .then(async () => {
                  setBody("");
                  await qc.invalidateQueries({ queryKey: ["thread", threadId] });
                  await qc.invalidateQueries({ queryKey: ["threads"] });
                  await qc.invalidateQueries({ queryKey: ["profile"] });
                })
                .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "الرسالة ما اتبعتتش"));
            }}
          >
            <input value={body} onChange={(e) => setBody(e.target.value)} className="h-12 flex-1 rounded-xl border border-line bg-card px-3" placeholder="اكتب رد" />
            <button type="submit" className="h-12 rounded-xl bg-green px-4 font-bold text-on-green">إرسال</button>
          </form>
        </div>
      ) : null}
    </Shell>
  );
}
