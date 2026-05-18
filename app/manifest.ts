import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PlayTennis.by — спарринг, тренер и турниры",
    short_name: "PlayTennis.by",
    description:
      "Открытая платформа любительского тенниса в Беларуси: находи соперника, выбирай тренера, записывайся в турниры или создавай свои.",
    start_url: "/ru",
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
