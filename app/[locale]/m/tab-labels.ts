import type { MTab } from "@/components/mobile/m-tab-bar";
import type { MPlaySheetLabels } from "@/components/mobile/m-play-sheet";

type Translator = (key: string) => string;

/** Tab labels shared by every mobile list screen. */
export function getMobileTabLabels(t: Translator): Record<MTab, string> {
  return {
    feed: t("tabs.feed"),
    tournaments: t("tabs.tournaments"),
    play: t("tabs.play"),
    matches: t("tabs.matches"),
    more: t("tabs.more"),
  };
}

/** Labels for the action-sheet opened from the central «Играть» FAB. */
export function getMobilePlayLabels(t: Translator): MPlaySheetLabels {
  return {
    open: t("play.open"),
    title: t("play.title"),
    subtitle: t("play.subtitle"),
    match_title: t("play.match_title"),
    match_sub: t("play.match_sub"),
    lesson_title: t("play.lesson_title"),
    lesson_sub: t("play.lesson_sub"),
    more_divider: t("play.more_divider"),
    record_score: t("play.record_score"),
    book_court: t("play.book_court"),
    cancel: t("play.cancel"),
  };
}
