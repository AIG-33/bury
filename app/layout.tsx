import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fontDisplay = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const fontSans = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-mono",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "OpenCourt.by — Платформа любительского тенниса в Беларуси",
    template: "%s · OpenCourt.by",
  },
  description:
    "Открытая платформа для всех любителей тенниса в Беларуси: единый Эло на все матчи, поиск соперника, турниры и тренеры — в одном месте.",
  keywords: [
    "tennis",
    "amateur tennis",
    "open court",
    "Elo rating",
    "find a player",
    "tournaments",
    "Minsk tennis",
    "Belarus tennis",
    "теннис",
    "любительский теннис",
    "теннис Минск",
    "теннис Беларусь",
    "OpenCourt.by",
  ],
  authors: [{ name: "OpenCourt.by" }],
  openGraph: {
    type: "website",
    title: "OpenCourt.by — единый Эло, соперники, турниры",
    description:
      "Один Эло-рейтинг на все матчи, поиск соперника по уровню и району, турниры в любых форматах. Открытая платформа для любителей тенниса в Беларуси.",
    siteName: "OpenCourt.by",
    locale: "ru_BY",
    alternateLocale: ["en_US"],
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenCourt.by — единый Эло, соперники, турниры",
    description:
      "Один Эло-рейтинг на все матчи, поиск соперника по уровню и району, турниры в любых форматах. Открытая платформа для любителей тенниса в Беларуси.",
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "OpenCourt.by",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icons/icon-192.png"],
  },
};

export const viewport = {
  themeColor: "#1f8a4c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      suppressHydrationWarning
      className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
