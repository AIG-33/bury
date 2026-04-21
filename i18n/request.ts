import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = (routing.locales as readonly string[]).includes(requested ?? "")
    ? (requested as (typeof routing.locales)[number])
    : routing.defaultLocale;

  const [app, help] = await Promise.all([
    import(`../messages/${locale}/app.json`).then((m) => m.default),
    import(`../messages/${locale}/help.json`).then((m) => m.default),
  ]);

  return {
    locale,
    messages: { ...app, help },
    timeZone: "Europe/Warsaw",
  };
});
