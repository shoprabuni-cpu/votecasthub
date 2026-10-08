import "server-only";
import { createClient } from "@/lib/supabase/server";
import { EVENT_PAGE_SIZE, type DirectoryFilters, type EventDirectoryPage } from "./directory";

export async function loadEventDirectory(filters: DirectoryFilters): Promise<EventDirectoryPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_event_directory", {
    p_search: filters.search.trim(), p_status: filters.status, p_mode: filters.mode,
    p_sort: filters.sort, p_offset: filters.offset, p_limit: EVENT_PAGE_SIZE,
  });
  if (error) throw new Error("Event directory unavailable", { cause: error });
  const page = data as { events: (EventDirectoryPage["events"][number] & { image_path: string | null })[]; total: number; now: number };
  const paths = [...new Set(page.events.flatMap(event => event.image_path ? [event.image_path] : []))];
  const { data: images } = paths.length ? await supabase.storage.from("nominee-images").createSignedUrls(paths, 3600) : { data: [] };
  const urls = new Map((images ?? []).flatMap(image => image.path && image.signedUrl ? [[image.path, image.signedUrl] as const] : []));
  return { total: page.total, now: page.now, events: page.events.map(({ image_path, ...event }) => ({ ...event, imageUrl: image_path ? urls.get(image_path) ?? null : null })) };
}
