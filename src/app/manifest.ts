import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "VotecastHub GH",
    short_name: "VotecastHub",
    description: "Discover events and manage your organization’s awards and competitions.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fafbf8",
    theme_color: "#1e704d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
