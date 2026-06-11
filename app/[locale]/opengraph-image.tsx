import { createPlayTennisOgImage, getOgImageAlt, OG_IMAGE_SIZE } from "@/lib/seo/og-image";

export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

type Props = { params: Promise<{ locale: string }> };

export async function generateImageMetadata({ params }: Props) {
  const { locale } = await params;
  const loc = locale === "en" ? "en" : "ru";
  return [
    {
      id: "default",
      alt: getOgImageAlt(loc),
      size: OG_IMAGE_SIZE,
      contentType: "image/png",
    },
  ];
}

export default async function LocaleOpenGraphImage({ params }: Props) {
  const { locale } = await params;
  return createPlayTennisOgImage(locale === "en" ? "en" : "ru");
}
