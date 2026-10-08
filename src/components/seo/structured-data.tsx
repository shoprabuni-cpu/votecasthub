import { headers } from "next/headers";
import { jsonLd } from "@/lib/seo/metadata";

export async function StructuredData({ data }: { data: unknown }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />;
}
