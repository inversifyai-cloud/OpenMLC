import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OpenMLC",
    short_name: "OpenMLC",
    description: "Self-hosted, BYOK AI chat client.",
    start_url: "/chat",
    display: "standalone",
    background_color: "#07080a",
    theme_color: "#22c55e",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/openmlc-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/openmlc-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
