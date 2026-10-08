import { ImageResponse } from "next/og";
import { z } from "zod";
import { loadPublicSearchMetadata } from "@/lib/seo/public-data";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const parsed = z.object({ event: z.string().min(1).max(200).regex(/^[a-zA-Z0-9-]+$/).optional(), nominee: z.uuid().optional() }).safeParse({ event: query.get("event") ?? undefined, nominee: query.get("nominee") ?? undefined });
  if (!parsed.success || (parsed.data.nominee && !parsed.data.event)) return new Response("Invalid image", { status: 400 });
  let title = "Good events deserve a fair vote.";
  let subtitle = "Online voting for awards, competitions and community events in Ghana.";
  if (parsed.data.event) {
    try {
      const data = await loadPublicSearchMetadata(parsed.data.event, parsed.data.nominee);
      if (!data) return new Response("Not found", { status: 404 });
      title = data.name.slice(0, 110);
      subtitle = parsed.data.nominee ? `Meet the nominee · ${data.event_name.slice(0, 100)}` : "Explore the nominees, read the rules and follow the voting schedule.";
    } catch { return new Response("Image temporarily unavailable", { status: 503 }); }
  }
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px", background: "#064e3b", color: "#ffffff" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "18px" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "64px", height: "64px", background: "#d1fae5", color: "#064e3b", borderRadius: "16px", fontSize: "42px", fontWeight: 700 }}>V</div><div style={{ fontSize: "34px", fontWeight: 700 }}>VotecastHub GH</div></div>
    <div style={{ display: "flex", flexDirection: "column" }}><div style={{ fontSize: title.length > 65 ? "52px" : "66px", fontWeight: 700, lineHeight: 1.12 }}>{title}</div><div style={{ marginTop: "24px", fontSize: "27px", color: "#d1fae5", lineHeight: 1.4 }}>{subtitle}</div></div>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "23px", color: "#a7f3d0" }}><span>Voting for events and awards</span><span>votecasthub.com</span></div>
  </div>, { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
}
