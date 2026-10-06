"use client";

import { useMemo, useRef, useState } from "react";
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
  const byKey = useMemo(() => new Map<string, Nominee>(nominees.flatMap((nominee) => [[key(nominee.public_code ?? ""), nominee] as [string, Nominee], [key(nominee.name), nominee] as [string, Nominee]]).filter(([name]) => name)), [nominees]);
  function choose(files: FileList | null) {
    if (!files) return;
    const next = [...files].map((file) => { const nominee = byKey.get(key(file.name)) ?? null; const valid = types.has(file.type) && file.size <= 5 * 1024 * 1024; return { file, nominee, status: valid && nominee ? "ready" : "error", message: !valid ? "Use JPEG, PNG, or WebP under 5 MB." : !nominee ? "No nominee matches this filename." : undefined, preview: URL.createObjectURL(file) } as Item; });
    setItems(next); setNotice("");
  }
  function downloadGuide() {
    const lines = ["VotecastHub nominee photo naming guide", "", "1. Name each image using the nominee public code when available.", "   Example: BNA-01.jpg", "2. If a nominee has no public code, use their exact name.", "   Example: Ama Mensah.png", "3. Use JPEG, PNG, or WebP images smaller than 5 MB.", "4. Select all images in the bulk uploader and review matches before uploading.", "", "Nominee filename reference:", ...nominees.map((nominee) => `${nominee.public_code || nominee.name}  ->  ${nominee.name}`)];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "votecasthub-image-naming-guide.txt"; link.click(); URL.revokeObjectURL(url);
  }
  async function upload(itemIndex: number) {
    if (cancelledRef.current) return;
    const item = items[itemIndex]; if (!item.nominee) return;
    setItems((current) => current.map((entry, index) => index === itemIndex ? { ...entry, status: "uploading", message: undefined } : entry));
    const path = `${eventId}/${item.nominee.id}/${crypto.randomUUID()}-${item.file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const supabase = createClient(); const result = await supabase.storage.from("nominee-images").upload(path, item.file, { contentType: item.file.type, upsert: false });
    if (result.error) { setItems((current) => current.map((entry, index) => index === itemIndex ? { ...entry, status: "error", message: "Upload failed. Retry this file." } : entry)); return; }
    const data = new FormData(); data.set("nomineeId", item.nominee.id); data.set("imagePath", path); data.set("backTo", backTo);
    const saved = await updateNomineeImageAction(null, data);
    if (!saved?.success) { await supabase.storage.from("nominee-images").remove([path]); setItems((current) => current.map((entry, index) => index === itemIndex ? { ...entry, status: "error", message: saved?.message ?? "Could not save image." } : entry)); return; }
    setItems((current) => current.map((entry, index) => index === itemIndex ? { ...entry, status: "done", message: "Uploaded" } : entry));
  }
  async function uploadAll() { cancelledRef.current = false; setBusy(true); const queue = items.map((item, index) => ({ item, index })).filter(({ item }) => item.status === "ready" || item.status === "error"); let cursor = 0; const worker = async () => { while (!cancelledRef.current) { const current = queue[cursor++]; if (!current) return; await upload(current.index); } }; await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker)); setBusy(false); setNotice(cancelledRef.current ? "Upload cancelled. Completed files were saved; pending files remain ready." : "Upload queue finished. Failed files can be retried individually."); }
  function cancelUploads() { cancelledRef.current = true; setItems((current) => current.map((item) => item.status === "ready" ? { ...item, status: "cancelled", message: "Not uploaded" } : item)); }
  const ready = items.filter((item) => item.status === "ready" || item.status === "error").length;
  return <section className="bulk-image-workspace" aria-labelledby="bulk-image-title"><div className="bulk-image-heading"><div><p className="eyebrow">LARGE EVENT TOOLS</p><h3 id="bulk-image-title">Upload nominee photos in bulk</h3><p>Use each nominee’s public code or exact name as the filename, for example <code>BNA-01.jpg</code>.</p><button type="button" className="text-link image-guide-link" onClick={downloadGuide}>Download naming guide for your team</button></div><label className="secondary-button bulk-image-picker">Choose photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => choose(event.target.files)} /></label></div><div className="bulk-image-help"><span><strong>{nominees.length}</strong> nominees</span><span><strong>{items.length}</strong> files selected</span><span>Up to 3 uploads at once · JPEG, PNG, WebP · 5 MB max</span></div>{items.length > 0 && <div className="bulk-image-list">{items.map((item, index) => <article className={`bulk-image-row is-${item.status}`} key={`${item.file.name}-${index}`}><img src={item.preview} alt="" /><div><strong>{item.file.name}</strong><small>{item.nominee ? `Matched to ${item.nominee.name}` : item.message}</small></div><span className="bulk-image-status">{item.status === "uploading" ? "Uploading…" : item.status === "done" ? "✓ Uploaded" : item.status === "error" ? "Needs attention" : item.status === "cancelled" ? "Cancelled" : "Ready"}</span>{item.status === "error" && item.nominee && <button type="button" className="text-link" onClick={() => upload(index)} disabled={busy}>Retry</button>}</article>)}</div>}{notice && <p className="form-message form-success" role="status">{notice}</p>}<div className="bulk-image-actions"><button type="button" className="primary-link" onClick={uploadAll} disabled={busy || ready === 0}>{busy ? "Uploading queue…" : `Upload ${ready} ready file${ready === 1 ? "" : "s"}`}</button>{busy && <button type="button" className="secondary-button" onClick={cancelUploads}>Cancel pending uploads</button>}<small>Unmatched files stay on your device and are never uploaded.</small></div></section>;
}

