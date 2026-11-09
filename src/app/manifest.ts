import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Businestra",
    short_name: "Businestra",
    description: "Credit sales & collections for Ghanaian distributors",
    start_url: "/app",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#065f46",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
