import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OpenCourt.by — Платформа любительского тенниса",
    short_name: "OpenCourt.by",
    description:
      "Открытая платформа для любителей тенниса в Беларуси: единый Эло на все матчи, поиск соперника, турниры и тренеры.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f9f4",
    theme_color: "#1f8a4c",
    lang: "ru",
    categories: ["sports", "lifestyle", "social"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
