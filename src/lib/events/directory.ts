import { z } from "zod";
import type { PublicEventCardData } from "@/components/events/public-event-card";

export const directoryFilters = z.object({
  search: z.string().max(120).default(""),
  status: z.enum(["active", "all", "open", "upcoming", "ending", "paused", "closed"]).default("all"),
  mode: z.enum(["all", "free", "paid"]).default("all"),
  sort: z.enum(["soonest", "newest", "name"]).default("soonest"),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});
export type DirectoryFilters = z.infer<typeof directoryFilters>;
export type EventDirectoryPage = { events: PublicEventCardData[]; total: number; now: number };
export const EVENT_PAGE_SIZE = 24;
