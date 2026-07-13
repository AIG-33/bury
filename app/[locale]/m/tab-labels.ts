import type { MTab } from "@/components/mobile/m-tab-bar";
import type { MMenuLabels } from "@/components/mobile/m-menu-sheet";

type Translator = (key: string) => string;

/** Tab labels shared by every mobile list screen. */
export function getMobileTabLabels(t: Translator): Record<MTab, string> {
  return {
    feed: t("tabs.feed"),
    tournaments: t("tabs.tournaments"),
    matches: t("tabs.matches"),
    clubs: t("tabs.clubs"),
    menu: t("tabs.menu"),
  };
}

/** Labels for the burger bottom-sheet opened from the 5th tab. */
export function getMobileMenuLabels(t: Translator): MMenuLabels {
  return {
    title: t("menu.title"),
    open: t("menu.open"),
    close: t("menu.close"),
    group_personal: t("menu.group_personal"),
    group_sections: t("menu.group_sections"),
    group_info: t("menu.group_info"),
    profile: t("menu.profile"),
    my_matches: t("menu.my_matches"),
    my_tournaments: t("menu.my_tournaments"),
    my_clubs: t("menu.my_clubs"),
    game: t("menu.game"),
    coaches: t("menu.coaches"),
    venues: t("menu.venues"),
    players: t("menu.players"),
    matches_feed: t("menu.matches_feed"),
    leaderboard: t("menu.leaderboard"),
    help: t("menu.help"),
    support: t("menu.support"),
    privacy: t("menu.privacy"),
    logout: t("menu.logout"),
    login: t("menu.login"),
  };
}
