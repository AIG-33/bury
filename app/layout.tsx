import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getOgImageAlt } from "@/lib/seo/og-image";
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/seo/site";
import { belarusTennisKeywords } from "@/lib/seo/metadata";
import { NativeBridge } from "@/components/mobile/native-bridge";

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

const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
const yandexVerification = process.env.NEXT_PUBLIC_YANDEX_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — найди соперника, тренера и турнир в Беларуси`,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    "Открытая платформа любительского тенниса в Беларуси: находите спарринг-партнёра по уровню и району, выбирайте тренера, записывайтесь в турниры или создавайте свой.",
  keywords: belarusTennisKeywords("ru"),
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "sports",
  openGraph: {
    type: "website",
    title: `${SITE_NAME} — спарринг, тренер и турниры в одном месте`,
    description:
      "Найди соперника по уровню и району, запишись к тренеру или в турнир — за пару минут. Открытая платформа любительского тенниса в Беларуси.",
    siteName: SITE_NAME,
    locale: "ru_BY",
    alternateLocale: ["en_US"],
    url: SITE_URL,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: getOgImageAlt("ru"),
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — спарринг, тренер и турниры в одном месте`,
    description:
      "Найди соперника по уровню и району, запишись к тренеру или в турнир — за пару минут. Открытая платформа любительского тенниса в Беларуси.",
    images: [DEFAULT_OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/ru",
    languages: {
      ru: "/ru",
      en: "/en",
      "x-default": "/ru",
    },
  },
  verification: {
    ...(googleVerification ? { google: googleVerification } : {}),
    ...(yandexVerification ? { yandex: yandexVerification } : {}),
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_NAME,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icons/icon-192.png"],
  },
  other: {
    "geo.region": "BY",
    "geo.placename": "Беларусь",
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
      <body>
        {children}
        <NativeBridge />
      </body>
    </html>
  );
}
