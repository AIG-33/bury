import { createPlayTennisOgImage, getOgImageAlt, OG_IMAGE_SIZE } from "@/lib/seo/og-image";

export const alt = getOgImageAlt("ru");
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default function TwitterImage() {
  return createPlayTennisOgImage("ru");
}
