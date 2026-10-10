"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateNomineeImageAction } from "@/lib/auth/actions";

type Nominee = { id: string; name: string; public_code: string | null; image_path: string | null };
type Item = { file: File; nominee: Nominee | null; status: "ready" | "uploading" | "done" | "error" | "cancelled"; message?: string; preview: string };
const types = new Set(["image/jpeg", "image/png", "image/webp"]);
const key = (value: string) => value.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]/g, "");

export function BulkNomineeImageUploader({ eventId, nominees, backTo }: { eventId: string; nominees: Nominee[]; backTo: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const cancelledRef = useRef(false);
  const byKey = useMemo(() => {
    const matches = new Map<string, Nominee[]>();
    for (const nominee of nominees) for (const value of new Set([key(nominee.public_code ?? ""), key(nominee.name)])) {
      if (value) matches.set(value, [...(matches.get(value) ?? []), nominee]);
    }
    return matches;
  }, [nominees]);
  const previewsRef = useRef<string[]>([]);
  useEffect(() => () => { cancelledRef.current = true; previewsRef.current.forEach(url => URL.revokeObjectURL(url)); }, []);
  function choose(files: FileList | null) {
    if (!files || busy) return;
    previewsRef.current.forEach(url => URL.revokeObjectURL(url));
    const next = [...files].map((file) => { const matches = byKey.get(key(file.name)) ?? []; const nominee = matches.length === 1 ? matches[0] : null; const valid = types.has(file.type) && file.size > 0 && file.size <= 5 * 1024 * 1024; return { file, nominee, status: valid && nominee ? "ready" : "error", message: !valid ? "Use JPEG, PNG, or WebP under 5 MB." : !nominee ? matches.length > 1 ? "Multiple nominees match. Upload this photo individually." : "No nominee matches this filename." : undefined, preview: URL.createObjectURL(file) } as Item; });
    previewsRef.current = next.map(item => item.preview);
    const seen = new Set<string>();
    for (const item of next) { if (item.nominee && seen.has(item.nominee.id)) { item.status = "error"; item.message = "Another selected photo already matches this nominee."; item.nominee = null; } else if (item.nominee) seen.add(item.nominee.id); }
    setItems(next); setNotice("");
  }
  function downloadGuide() {
    const lines = ["VotecastHub nominee photo naming guide", "", "1. Name each image using the nominee public code when available.", "   Example: BNA-01.jpg", "2. If a nominee has no public code, use their exact name.", "   Example: Ama Mensah.png", "3. Use JPEG, PNG, or WebP images smaller than 5 MB.", "4. Select all images in the bulk uploader and review matches before uploading.", "", "Nominee filename reference:", ...nominees.map((nominee) => `${nominee.public_code || nominee.name}  ->  ${nominee.name}`)];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "votecasthub-image-naming-guide.txt"; link.click(); URL.revokeObjectURL(url);
  }
  async function upload(itemIndex: number) {
    if (cancelledRef.current) return;
    const item = items[itemIndex]; if (!item.nominee || !types.has(item.file.type) || item.file.size === 0 || item.file.size > 5 * 1024 * 1024) return;
    setItems((current) => current.map((entry, index) => index === itemIndex ? { ...entry, status: "uploading", message: undefined } : entry));
    try {
    const path = `${eventId}/${item.nominee.id}/${crypto.randomUUID()}-${item.file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const supabase = createClient(); const result = await supabase.storage.from("nominee-images").upload(path, item.file, { contentType: item.file.type, upsert: false });
    if (result.error) { setItems((current) => current.map((entry, index) => index === itemIndex ? { ...entry, status: "error", message: "Upload failed. Retry this file." } : entry)); return; }
    const data = new FormData(); data.set("nomineeId", item.nominee.id); data.set("imagePath", path); data.set("backTo", backTo);
    const saved = await updateNomineeImageAction(null, data);
    if (!saved?.success) { await supabase.storage.from("nominee-images").remove([path]); setItems((current) => current.map((entry, index) => index === itemIndex ? { ...entry, status: "error", message: saved?.message ?? "Could not save image." } : entry)); return; }
    setItems((current) => current.map((entry, index) => index === itemIndex ? { ...entry, status: "done", message: "Uploaded" } : entry));
    } catch { setItems(current => current.map((entry, index) => index === itemIndex ? { ...entry, status: "error", message: "Connection interrupted. Retry this photo." } : entry)); }
  }
  async function uploadAll() { cancelledRef.current = false; setBusy(true); const queue = items.map((item, index) => ({ item, index })).filter(({ item }) => item.nominee && types.has(item.file.type) && item.file.size > 0 && item.file.size <= 5 * 1024 * 1024 && (item.status === "ready" || item.status === "error" || item.status === "cancelled")); let cursor = 0; const worker = async () => { while (!cancelledRef.current) { const current = queue[cursor++]; if (!current) return; await upload(current.index); } }; try { await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker)); } catch { setNotice("An upload was interrupted. Retry the remaining photos."); } finally { setBusy(false); } setNotice(cancelledRef.current ? "Upload cancelled. Completed files were saved; pending files remain ready." : "Upload queue finished. Failed files can be retried individually."); }
  function cancelUploads() { cancelledRef.current = true; setItems((current) => current.map((item) => item.status === "ready" ? { ...item, status: "cancelled", message: "Not uploaded" } : item)); }
  const ready = items.filter(item => item.nominee && types.has(item.file.type) && item.file.size > 0 && item.file.size <= 5 * 1024 * 1024 && ["ready", "error", "cancelled"].includes(item.status)).length;
  return <section className="space-y-5" aria-labelledby="bulk-image-title"><div className="flex flex-col gap-4 sm:flex-row sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">LARGE EVENT TOOLS</p><h3 id="bulk-image-title" className="mt-1 text-lg font-semibold text-stone-900">Upload nominee photos in bulk</h3><p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">Use each nominee’s public code or exact name as the filename, for example <code>BNA-01.jpg</code>.</p><button type="button" className="min-h-11 text-sm font-semibold text-emerald-800 border border-stone-300 bg-white shadow-xs rounded-xl px-4 py-2.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" onClick={downloadGuide}>Download naming guide for your team</button></div><label className="flex min-h-11 flex-col gap-2 rounded-xl border border-stone-200 p-3 text-sm">Choose photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={(event) => choose(event.target.files)} /></label></div><div className="flex flex-wrap gap-3 rounded-xl bg-stone-50 p-3 text-sm text-stone-600"><span><strong>{nominees.length}</strong> nominees</span><span><strong>{items.length}</strong> files selected</span><span>Up to 3 uploads at once · JPEG, PNG, WebP · 5 MB max</span></div>{items.length > 0 && <div className="space-y-3">{items.map((item, index) => <article className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 p-3 [&_img]:size-12 [&_img]:rounded-lg [&_img]:object-cover [&_small]:block" key={`${item.file.name}-${index}`}><img src={item.preview} alt="" /><div><strong>{item.file.name}</strong><small>{item.message || (item.nominee ? `Matched to ${item.nominee.name}` : "No match")}</small></div><span className="text-xs font-semibold text-stone-600">{item.status === "uploading" ? "Uploading…" : item.status === "done" ? "✓ Uploaded" : item.status === "error" ? "Needs attention" : item.status === "cancelled" ? "Cancelled" : "Ready"}</span>{item.status === "error" && item.nominee && types.has(item.file.type) && item.file.size > 0 && item.file.size <= 5 * 1024 * 1024 && <button type="button" className="min-h-11 text-sm font-semibold text-emerald-800 border border-stone-300 bg-white shadow-xs rounded-xl px-4 py-2.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => { cancelledRef.current = false; void upload(index); }} disabled={busy}>Retry</button>}</article>)}</div>}{notice && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{notice}</p>}<div className="flex flex-wrap items-center gap-3 text-sm"><button type="button" className="min-h-11 rounded-xl bg-emerald-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed" onClick={uploadAll} disabled={busy || ready === 0}>{busy ? "Uploading queue…" : `Upload ${ready} ready file${ready === 1 ? "" : "s"}`}</button>{busy && <button type="button" className="min-h-11 rounded-xl border border-stone-300 px-4 py-2 text-sm bg-white shadow-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" onClick={cancelUploads}>Cancel pending uploads</button>}<small>Unmatched files stay on your device and are never uploaded.</small></div></section>;
}

