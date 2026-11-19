import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CyberX OSINT",
    short_name: "CyberX",
    description: "Public-source research workspace",
    start_url: "/",
    display: "standalone",
    background_color: "#07152f",
    theme_color: "#07152f",
    orientation: "portrait",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }]
  };
}