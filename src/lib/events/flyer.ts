import { eventPresentation, ghanaDate } from "./presentation";
export type FlyerDetails = {
  nominee?: string; category?: string; imageUrl?: string | null; eventName?: string;
  code?: string | null; startsAt?: string; endsAt?: string; status?: string;
  votingMode?: "free" | "paid"; unitPriceMinor?: number;
};
function lines(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const output: string[] = []; let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && ctx.measureText(line + " " + word).width > width) { output.push(line); line = ""; }
    for (const letter of (line ? " " : "") + word) {
      if (ctx.measureText(line + letter).width > width && line) { output.push(line); line = ""; }
      line += letter;
    }
  }
  if (line) output.push(line);
  return output;
}
function textBlock(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, size: number, count = 2, weight = 700) {
  let rows: string[] = [];
  do { ctx.font = `${weight} ${size}px Arial, sans-serif`; rows = lines(ctx, text, width); if (rows.length <= count || size <= 24) break; size -= 2; } while (true);
  const visible = rows.slice(0,count);
  if (rows.length > count) {
    let last = visible[count-1];
    while (last && ctx.measureText(last + "…").width > width) last = last.slice(0,-1);
    visible[count-1] = last + "…";
  }
  visible.forEach((row, i) => ctx.fillText(row, x, y + i * size * 1.18));
}
async function loadPhoto(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("Photo unavailable");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/") || blob.size > 10 * 1024 * 1024) throw new Error("Photo unavailable");
  const objectUrl = URL.createObjectURL(blob);
  try { const image = new Image(); image.src = objectUrl; await image.decode(); return image; }
  finally { URL.revokeObjectURL(objectUrl); }
}
export async function createFlyer(title: string, url: string, detail: FlyerDetails) {
  const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Your browser could not create a flyer.");
  ctx.fillStyle = "#f6f3e9"; ctx.fillRect(0,0,1080,1350);
  ctx.fillStyle = "#123e2d"; ctx.fillRect(0,0,1080,180);
  ctx.fillStyle = "#d8f0a2"; ctx.font = "700 25px Arial"; ctx.fillText("VOTECASTHUB  /  GH",64,55);
  ctx.fillStyle = "#ffffff"; textBlock(ctx, detail.eventName || title,64,102,952,38,2);
  ctx.save(); ctx.beginPath(); ctx.roundRect(48,204,984,558,28); ctx.clip();
  const gradient = ctx.createLinearGradient(0,204,1080,762); gradient.addColorStop(0,"#245940"); gradient.addColorStop(1,"#143e2e");
  ctx.fillStyle = gradient; ctx.fillRect(48,204,984,558);
  let photoLoaded = false;
  if (detail.imageUrl) {
    try {
      const image = await loadPhoto(detail.imageUrl);
      const scale = detail.nominee ? Math.min(984/image.width,558/image.height) : Math.max(984/image.width,558/image.height);
      const w = image.width * scale, h = image.height * scale;
      ctx.drawImage(image,48+(984-w)/2,204+(558-h)/2,w,h);
      photoLoaded = true;
    } catch { /* A useful text flyer remains available when an image cannot load. */ }
  }
  if (!photoLoaded) {
    ctx.strokeStyle = "#94b981"; ctx.lineWidth = 2;
    for (const radius of [140,200,260]) { ctx.beginPath(); ctx.arc(540,483,radius,0,Math.PI*2); ctx.stroke(); }
    ctx.fillStyle = "#e1f2be"; ctx.font = "700 150px Georgia"; ctx.textAlign = "center";
    ctx.fillText((detail.nominee || title).trim().slice(0,1).toUpperCase(),540,534); ctx.textAlign = "left";
  }
  ctx.restore();
  const state = detail.startsAt && detail.endsAt ? eventPresentation({ status: detail.status || "published", starts_at: detail.startsAt, ends_at: detail.endsAt }) : null;
  ctx.fillStyle = "#437052"; ctx.font = "700 22px Arial";
  ctx.fillText(detail.nominee ? "NOMINEE SPOTLIGHT" : "EVENT SPOTLIGHT",64,806);
  ctx.fillStyle = "#173f2d"; textBlock(ctx,detail.nominee || title,64,866,952,58,2);
  ctx.fillStyle = "#52654f"; textBlock(ctx,detail.category || state?.cta || "Discover the event",64,1000,952,30,1,500);
  if (detail.code) { ctx.font="700 24px Arial"; ctx.fillText("NOMINEE CODE  " + detail.code,64,1043); }
  ctx.fillStyle = "#173f2d"; ctx.font="600 25px Arial";
  const timing = state?.key === "upcoming" && detail.startsAt ? "Opens " + ghanaDate(detail.startsAt) : detail.endsAt ? (state?.key === "closed" ? "Scheduled end " : "Closes ") + ghanaDate(detail.endsAt) : "";
  ctx.fillText(timing + (timing ? " · Ghana time" : ""),64,1104);
  ctx.fillStyle = "#52654f"; ctx.font = "24px Arial";
  ctx.fillText(detail.votingMode === "paid" ? `GHS ${((detail.unitPriceMinor ?? 0)/100).toFixed(2)} per vote` : detail.votingMode === "free" ? "Free voting · Phone verification required" : "",64,1146);
  ctx.fillStyle="#173f2d"; ctx.fillRect(0,1190,1080,160);
  ctx.fillStyle="#d8f0a2"; ctx.font="700 27px Arial"; ctx.fillText(state?.key === "open" ? detail.nominee ? "VOTE • SHARE • SHOW YOUR SUPPORT" : "MEET THE NOMINEES & CAST YOUR VOTE" : (state?.label || "EXPLORE THE EVENT").toUpperCase(),64,1233);
  ctx.fillStyle="#ffffff"; textBlock(ctx,url.replace(/^https?:\/\//,""),64,1277,952,24,2,400);
  const blob = await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/png"));
  if (!blob) throw new Error("The flyer could not be created. Please try again.");
  return { blob, photoMissing: Boolean(detail.imageUrl && !photoLoaded) };
}
