"use client";
import { useEffect, useRef, useState } from "react";
import { AppModal } from "@/components/ui/app-modal";
import { createFlyer, type FlyerDetails } from "@/lib/events/flyer";
export function ShareButton({ title, text, url, flyer }: { title: string; text: string; url: string; flyer?: FlyerDetails }) {
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const [preview,setPreview] = useState<{ file: File; url: string; photoMissing: boolean } | null>(null);
  const [open,setOpen] = useState(false);
  const current = useRef<string|null>(null);
  useEffect(()=>()=>{if(current.current)URL.revokeObjectURL(current.current);},[]);
  const publicUrl = () => new URL(url,window.location.origin).href;
  async function shareLink() {
    setMessage("");
    try {
      if (navigator.share) await navigator.share({ title,text,url:publicUrl() });
      else { await navigator.clipboard.writeText(publicUrl()); setMessage("Link copied. Paste it into WhatsApp, a message or a social post."); }
    } catch (error) { if ((error as Error).name !== "AbortError") setMessage("Sharing could not open. You can copy the link below."); }
  }
  async function make() {
    if (!flyer || busy) return;
    setBusy(true); setMessage("");
    try {
      const result = await createFlyer(title,publicUrl(),flyer);
      if(current.current)URL.revokeObjectURL(current.current);
      current.current=URL.createObjectURL(result.blob);
      const filename=(title.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,60)||"event")+"-flyer.png";
      setPreview({file:new File([result.blob],filename,{type:"image/png"}),url:current.current,photoMissing:result.photoMissing});
      setOpen(true);
    } catch(error) {setMessage(error instanceof Error?error.message:"Could not create a flyer. Please try again.");}
    finally {setBusy(false);}
  }
  async function shareFlyer() {
    if(!preview)return;
    try {
      if(navigator.canShare?.({files:[preview.file]}) && navigator.share) await navigator.share({files:[preview.file],title,text: text+"\n"+publicUrl()});
      else {download();setMessage("Flyer downloaded. Share the image with the public link.");}
    } catch(error) {if((error as Error).name!=="AbortError")setMessage("Your device could not share this image. Use Download PNG instead.");}
  }
  function download() {if(!preview)return;const link=document.createElement("a");link.href=preview.url;link.download=preview.file.name;link.click();}
  return <div className="share-tools"><div className="share-actions"><button type="button" className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 shadow-xs hover:bg-stone-100 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" onClick={shareLink}>Share link ↗</button>{flyer && <button type="button" className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-900 bg-emerald-900 px-5 py-3 text-sm font-semibold text-white shadow-xs hover:bg-emerald-800 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" onClick={make} disabled={busy}>{busy?"Creating flyer…":"Create share flyer"}</button>}</div>
    {message && <p className="share-feedback" role="status">{message}</p>}
    {message && <input className="share-link-copy" aria-label="Public sharing link" readOnly value={typeof window!=="undefined"?publicUrl():url} onFocus={e=>e.target.select()} />}
    <AppModal open={open} title="Official Campaign Flyer" message="Download your high-resolution flyer or share directly to your WhatsApp Status and social media." confirmLabel="Share flyer" cancelLabel="Close" onCancel={()=>setOpen(false)} onConfirm={shareFlyer}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Local canvas blob preview does not use the image optimization server. */}
      {preview && (
        <div className="space-y-3">
          <img className="flyer-preview rounded-xl border border-stone-200 shadow-md" src={preview.url} alt={`Share flyer for ${title}`} width={1080} height={1350}/>
          {preview.photoMissing && <p role="status" className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">The nominee photo could not load in time, so this flyer uses a prestigious monogram seal. Refresh the page to retry with the full photo.</p>}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-stone-500 font-medium">1080 × 1350 px &middot; HD Social &amp; Print Ready</span>
            <div className="flex items-center gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`🏆 Support *${title}*! Cast your vote now on WhatsApp or Web:\n${publicUrl()}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100/80 shadow-2xs"
              >
                <span>💬</span>
                <span>Share to WhatsApp</span>
              </a>
              <button
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-stone-800 cursor-pointer"
                type="button"
                onClick={download}
              >
                <span>📥</span>
                <span>Download PNG</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AppModal>
  </div>;
}
