import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wellness — Tiffany's Dashboard",
    short_name: "Wellness",
    description:
      "A calm, beautiful place to close the loop on ten daily commitments — habits, supplements, quotes, reading, chess, and analytics.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF7F2",
    theme_color: "#FBF7F2",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
