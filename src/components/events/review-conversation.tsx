import { createClient } from "@/lib/supabase/server";
import { ghanaDate } from "@/lib/events/presentation";
import { ReviewMessageForm } from "./review-message-form";

export async function EventReviewConversation({ eventId, canReply = true }: { eventId: string; canReply?: boolean }) {
  const db = await createClient();
  const { data, error } = await db.from("event_review_messages").select("id,kind,body,created_at").eq("event_id", eventId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50);
  const labels: Record<string, string> = { returned: "Platform: changes requested", comment: "Platform message", reply: "Organizer reply", submitted: "Submitted for review", approved: "Approved", withdrawn: "Returned to draft" };
  return (
    <section id="review-feedback" className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs transition-colors dark:border-[#1c2721] dark:bg-[#0c120e] sm:p-6">
      <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 dark:text-stone-100">Review feedback & messages</h2>
      <p className="mt-1 text-xs sm:text-sm text-stone-600 dark:text-stone-400">Private between your organization and the platform team. Replies also appear in notifications.</p>
      {error ? (
        <p role="alert" className="mt-4 text-xs sm:text-sm text-red-800 dark:text-red-400">Messages could not load. Refresh before sending a reply.</p>
      ) : (
        <>
          <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">
            {data?.length ? (
              [...data].reverse().map(message => (
                <article key={message.id} className={`rounded-xl border p-3.5 transition-colors ${message.kind === "returned" ? "border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20" : "border-stone-200 bg-stone-50/70 dark:border-[#1c2721] dark:bg-[#141b16]/60"}`}>
                  <p className="text-xs font-mono font-bold text-stone-700 dark:text-stone-300">{labels[message.kind] ?? "Review update"} · {ghanaDate(message.created_at)}</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-xs sm:text-sm text-stone-800 dark:text-stone-200 leading-relaxed">{message.body}</p>
                </article>
              ))
            ) : (
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">No review messages yet.</p>
            )}
          </div>
          {canReply && <ReviewMessageForm eventId={eventId} />}
        </>
      )}
    </section>
  );
}
