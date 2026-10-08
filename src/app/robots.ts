import type { MetadataRoute } from "next";
import { absoluteUrl, isPreviewDeployment } from "@/lib/seo/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: isPreviewDeployment() ? { userAgent: "*", disallow: "/" } : {
      userAgent: "*", allow: ["/", "/api/og"], disallow: ["/api/", "/admin", "/organizer", "/auth/", "/invite/", "/payments/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
