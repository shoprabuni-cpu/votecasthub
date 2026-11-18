import { createClient } from "@/lib/supabase/server";
import { ghanaDate } from "@/lib/events/presentation";

export async function EventNotices({ eventId }: { eventId: string }) {
  const db = await createClient();
  const { data, error } = await db
    .from("event_notices")
    .select("id,kind,message,previous_deadline,new_deadline,created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <p role="status" className="my-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
        Event updates could not be loaded. Please refresh for the latest announcements.
      </p>
    );
  }
  if (!data?.length) return null;

  return (
    <section className="my-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 text-left dark:border-[#1c2721] dark:bg-[#0c120e]">
      <h2 className="font-serif text-lg font-medium text-stone-900 dark:text-white mb-4">Updates from the organizer</h2>
      <div className="space-y-4 divide-y divide-emerald-200/60 dark:divide-[#1c2721]">
        {data.map((n) => (
          <article key={n.id} className="pt-4 first:pt-0">
            <span className="text-[10px] font-bold tracking-widest text-emerald-800 uppercase dark:text-emerald-400">
              {n.kind === "reopened" ? "VOTING REOPENED" : n.kind === "extension" ? "DEADLINE EXTENDED" : "EVENT UPDATE"}
            </span>
            <p className="mt-1 text-sm leading-relaxed text-stone-700 dark:text-stone-300">{n.message}</p>
            {n.previous_deadline && n.new_deadline && (
              <p className="mt-2 text-xs text-stone-600 dark:text-stone-400">
                <strong>Previous deadline:</strong> {ghanaDate(n.previous_deadline)}
                <br />
                <strong>New deadline:</strong> {ghanaDate(n.new_deadline)} · Ghana time
              </p>
            )}
            <small className="block mt-2 text-[10px] text-stone-500 dark:text-stone-400">
              Published {ghanaDate(n.created_at)} · Ghana time
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}
