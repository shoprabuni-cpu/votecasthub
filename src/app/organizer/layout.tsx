import type { ReactNode } from "react";
import { PRIVATE_ROBOTS } from "@/lib/seo/metadata";

export const metadata = { robots: PRIVATE_ROBOTS };
export default function OrganizerLayout({ children }: { children: ReactNode }) { return children; }
