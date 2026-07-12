import type { MTab } from "@/components/mobile/m-tab-bar";

type Translator = (key: string) => string;

/** Tab labels shared by every mobile list screen. */
export function getMobileTabLabels(t: Translator): Record<MTab, string> {
  return {
    feed: t("tabs.feed"),
    tournaments: t("tabs.tournaments"),
    matches: t("tabs.matches"),
    clubs: t("tabs.clubs"),
    profile: t("tabs.profile"),
  };
}
