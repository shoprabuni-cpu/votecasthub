import { NextResponse } from "next/server";
import { directoryFilters } from "@/lib/events/directory";
import { loadEventDirectory } from "@/lib/events/load-directory";

export async function GET(request: Request) {
  const parsed = directoryFilters.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid event filters" }, { status: 400 });
  try {
    return NextResponse.json(await loadEventDirectory(parsed.data), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Events are temporarily unavailable. Please try again." }, { status: 503 });
  }
}
