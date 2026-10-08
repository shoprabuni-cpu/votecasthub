"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Notice = { id: string; title: string; body: string; read_at: string | null; created_at: string; organization_id?: string | null; event_id?: string | null };
export function NotificationBell({ notifications, organizationId, admin = false }: { notifications: Notice[]; organizationId?: string; admin?: boolean }) {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<{ key: string; items: Notice[] } | null>(null);
  const [read, setRead] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const router = useRouter();
  const key = JSON.stringify(notifications);
  const items = snapshot?.key === key ? snapshot.items : notifications;
  const unread = items.filter(item => !item.read_at && !read[item.id]).length;

  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch(`/api/notifications${organizationId ? `?organizationId=${organizationId}` : ""}`, { signal: controller.signal, cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          if (!controller.signal.aborted) {
            setSnapshot({ key, items: data.notifications });
            const known = new Set((JSON.parse(key) as Notice[]).map(item => item.id));
            if ((data.notifications as Notice[]).some(item => !known.has(item.id))) router.refresh();
          }
        }
      } catch { /* Keep the last successful list while offline. */ }
    };
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    if (open) void refresh();
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [key, organizationId, open, router]);

  async function mark(id: string) {
    try {
      const response = await fetch("/api/notifications/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
      if (!response.ok) throw new Error();
      setRead(previous => ({ ...previous, [id]: true }));
      setError("");
    } catch { setError("Could not mark this notification as read. Try again."); }
  }

  return <div className="pointer-events-auto relative z-40">
    <button className="relative min-h-11 rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-800 shadow-sm" type="button" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} onClick={() => setOpen(value => !value)}>Notifications {unread > 0 && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{unread > 9 ? "9+" : unread}</span>}</button>
    {open && <div className="absolute right-0 mt-2 max-h-[70vh] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-3 shadow-xl">
      <div className="mb-3 flex items-center justify-between"><strong className="text-sm">Notifications</strong><button type="button" className="min-h-11 px-3 text-xs" onClick={() => setOpen(false)}>Close</button></div>
      {error && <p role="alert" className="mb-2 text-xs text-red-800">{error}</p>}
      {items.length ? items.map(item => {
        const href = item.event_id ? admin ? `/admin/events/${item.event_id}#review-feedback` : item.organization_id ? `/organizer/${item.organization_id}/events/${item.event_id}#review-feedback` : null : null;
        return <article key={item.id} className={`mb-2 rounded-xl border p-3 ${item.read_at || read[item.id] ? "border-stone-200" : "border-amber-200 bg-amber-50"}`}><p className="text-sm font-semibold text-stone-900">{item.title}</p><p className="mt-1 whitespace-pre-wrap break-words text-xs text-stone-600">{item.body}</p>{href ? <Link className="mt-2 inline-flex min-h-11 items-center text-xs font-semibold text-emerald-800" href={href} onClick={() => { void mark(item.id); setOpen(false); }}>View event & reply →</Link> : <button type="button" className="mt-2 min-h-11 text-xs font-semibold text-emerald-800" onClick={() => mark(item.id)}>Mark as read</button>}</article>;
      }) : <p className="text-sm text-stone-500">No notifications yet.</p>}
    </div>}
  </div>;
}
