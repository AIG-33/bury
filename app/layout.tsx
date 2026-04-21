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
    default: "Aliaksandr Bury Tennis Platform",
    template: "%s · Bury Tennis",
  },
  description:
    "Universal Elo rating, find-a-player, tournaments and a tennis club run by a pro.",
  keywords: [
    "tennis",
    "tennis club",
    "Elo rating",
    "find a player",
    "tournaments",
    "Warsaw tennis",
    "Poland tennis",
    "Aliaksandr Bury",
  ],
  authors: [{ name: "Aliaksandr Bury Tennis Club" }],
  openGraph: {
    type: "website",
    title: "Bury Tennis — Universal Elo + Tennis Platform",
    description:
      "Single Elo across all your matches, find a player nearby, run friendly and serious tournaments.",
    siteName: "Bury Tennis",
    locale: "pl_PL",
    alternateLocale: ["en_US", "ru_RU"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bury Tennis — Universal Elo + Tennis Platform",
    description:
      "Single Elo across all your matches, find a player nearby, run friendly and serious tournaments.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      suppressHydrationWarning
      className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
