import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawCode = searchParams.get("code");

  if (!rawCode || rawCode.trim().length === 0) {
    return NextResponse.json(
      { matchType: "not_found", message: "Please provide a nominee code to search." },
      { status: 400 }
    );
  }

  const cleanCode = rawCode.trim().toUpperCase();
  const supabase = await createClient();

  try {
    // 1. First, search for exact match on public_code among active nominees in published/paused events
    const { data: exactMatches, error: exactErr } = await supabase
      .from("nominees")
      .select(`
        id,
        name,
        public_code,
        biography,
        image_path,
        category_id,
        categories!inner (
          id,
          name,
          event_id,
          is_active,
          events!inner (
            id,
            name,
            slug,
            status,
            currency,
            unit_price_minor,
            voting_mode,
            event_type
          )
        )
      `)
      .eq("is_active", true)
      .eq("categories.is_active", true)
      .in("categories.events.status", ["published", "paused"])
      .ilike("public_code", cleanCode);

    if (exactErr) {
      return NextResponse.json({ matchType: "error", error: exactErr.message }, { status: 500 });
    }

    let candidates = exactMatches || [];

    // 2. If no exact match, try prefix/suffix match (e.g. voter typed "01" or "BSP01" and code is "AMES-01" or "AMES-BSP01")
    if (candidates.length === 0) {
      const { data: partialMatches } = await supabase
        .from("nominees")
        .select(`
          id,
          name,
          public_code,
          biography,
          image_path,
          category_id,
          categories!inner (
            id,
            name,
            event_id,
            is_active,
            events!inner (
              id,
              name,
              slug,
              status,
              currency,
              unit_price_minor,
              voting_mode,
              event_type
            )
          )
        `)
        .eq("is_active", true)
        .eq("categories.is_active", true)
        .in("categories.events.status", ["published", "paused"])
        .or(`public_code.ilike.%-${cleanCode},public_code.ilike.${cleanCode}-%,public_code.ilike.%${cleanCode}%`)
        .limit(6);

      candidates = partialMatches || [];
    }

    // 3. If exact 1 match found: Fetch sibling nominees in the same category for the bottom rail
    if (candidates.length === 1) {
      const match = candidates[0];
      const category = match.categories as any;
      const event = category?.events;

      // Fetch other nominees in this category
      const { data: siblings } = await supabase
        .from("nominees")
        .select("id, name, public_code, image_path")
        .eq("category_id", match.category_id)
        .eq("is_active", true)
        .neq("id", match.id)
        .order("display_order", { ascending: true })
        .limit(8);

      // Sign images from supabase storage if relative paths
      const allPaths = [match.image_path, ...(siblings || []).map((s) => s.image_path)].filter(Boolean) as string[];
      const urlMap = new Map<string, string>();
      if (allPaths.length > 0) {
        const { data: signedImgs } = await supabase.storage.from("nominee-images").createSignedUrls(allPaths, 3600);
        if (signedImgs) {
          for (const img of signedImgs) {
            if (img.path && img.signedUrl) urlMap.set(img.path, img.signedUrl);
          }
        }
      }

      return NextResponse.json({
        matchType: "single_nominee",
        nominee: {
          id: match.id,
          name: match.name,
          public_code: match.public_code,
          biography: match.biography,
          image_path: match.image_path ? (urlMap.get(match.image_path) ?? match.image_path) : null,
        },
        category: {
          id: category.id,
          name: category.name,
        },
        event: {
          id: event.id,
          name: event.name,
          slug: event.slug,
          status: event.status,
          currency: event.currency,
          unit_price_minor: event.unit_price_minor,
          voting_mode: event.voting_mode,
          event_type: event.event_type,
        },
        siblingNominees: (siblings || []).map((s) => ({
          ...s,
          image_path: s.image_path ? (urlMap.get(s.image_path) ?? s.image_path) : null,
        })),
      });
    }

    // 4. If multiple nominees match (e.g. collision on a bare number or category code across two events)
    if (candidates.length > 1) {
      const matchPaths = candidates.map((m) => m.image_path).filter(Boolean) as string[];
      const urlMap = new Map<string, string>();
      if (matchPaths.length > 0) {
        const { data: signedImgs } = await supabase.storage.from("nominee-images").createSignedUrls(matchPaths, 3600);
        if (signedImgs) {
          for (const img of signedImgs) {
            if (img.path && img.signedUrl) urlMap.set(img.path, img.signedUrl);
          }
        }
      }

      return NextResponse.json({
        matchType: "multiple_nominees",
        query: cleanCode,
        matches: candidates.map((m) => {
          const cat = m.categories as any;
          const evt = cat?.events;
          return {
            nominee: {
              id: m.id,
              name: m.name,
              public_code: m.public_code,
              image_path: m.image_path ? (urlMap.get(m.image_path) ?? m.image_path) : null,
            },
            category: {
              id: cat.id,
              name: cat.name,
            },
            event: {
              id: evt.id,
              name: evt.name,
              slug: evt.slug,
            },
          };
        }),
      });
    }

    // 5. If no nominees found, check if code matches an event slug or USSD event code
    const { data: eventMatch } = await supabase
      .from("events")
      .select("id, name, slug, status, currency, unit_price_minor, voting_mode, event_type")
      .in("status", ["published", "paused"])
      .or(`slug.eq.${cleanCode.toLowerCase()},name.ilike.%${cleanCode}%`)
      .limit(1)
      .maybeSingle();

    if (eventMatch) {
      return NextResponse.json({
        matchType: "event",
        event: eventMatch,
      });
    }

    return NextResponse.json({
      matchType: "not_found",
      query: cleanCode,
      message: `No active nominee found with code "${cleanCode}". Please double check the flyer or code.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { matchType: "error", error: err?.message || "Failed to search nominee code." },
      { status: 500 }
    );
  }
}
