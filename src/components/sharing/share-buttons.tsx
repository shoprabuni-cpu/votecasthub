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
    <AppModal open={open} title="Your share flyer" message="Share the image and link with your community, or download a PNG for your next post." confirmLabel="Share flyer" cancelLabel="Done" onCancel={()=>setOpen(false)} onConfirm={shareFlyer}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Local canvas blob preview does not use the image optimization server. */}
      {preview && <><img className="flyer-preview" src={preview.url} alt={`Share flyer for ${title}`} width={1080} height={1350}/>{preview.photoMissing && <p role="status">The photo could not load, so this preview uses a branded background. Refresh the page to retry with the photo.</p>}<button className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 shadow-xs hover:bg-stone-100 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={download}>Download PNG</button></>}
    </AppModal>
  </div>;
}
