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
    default: "PlayTennis.by — найди соперника, тренера и турнир в Беларуси",
    template: "%s · PlayTennis.by",
  },
  description:
    "Открытая платформа любительского тенниса в Беларуси: находите спарринг-партнёра по уровню и району, выбирайте тренера, записывайтесь в турниры или создавайте свой.",
  keywords: [
    "tennis",
    "amateur tennis",
    "find a sparring partner",
    "tennis coach",
    "tennis tournaments",
    "Minsk tennis",
    "Belarus tennis",
    "теннис",
    "любительский теннис",
    "найти спарринг-партнёра",
    "тренер по теннису",
    "теннисные турниры",
    "теннис Минск",
    "теннис Беларусь",
    "PlayTennis.by",
  ],
  authors: [{ name: "PlayTennis.by" }],
  openGraph: {
    type: "website",
    title: "PlayTennis.by — спарринг, тренер и турниры в одном месте",
    description:
      "Найди соперника по уровню и району, запишись к тренеру или в турнир — за пару минут. Открытая платформа любительского тенниса в Беларуси.",
    siteName: "PlayTennis.by",
    locale: "ru_BY",
    alternateLocale: ["en_US"],
  },
  twitter: {
    card: "summary_large_image",
    title: "PlayTennis.by — спарринг, тренер и турниры в одном месте",
    description:
      "Найди соперника по уровню и району, запишись к тренеру или в турнир — за пару минут. Открытая платформа любительского тенниса в Беларуси.",
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PlayTennis.by",
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
