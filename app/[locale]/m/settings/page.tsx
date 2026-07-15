import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import {
  ChevronRight,
  HelpCircle,
  LogOut,
  Mail,
  MessageCircle,
  Send,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { MTabBar } from "@/components/mobile/m-tab-bar";
import { MContent, MEmptyState, MEyebrow, MSubHeader } from "@/components/mobile/m-ui";
import { DeleteAccountSection } from "@/components/account/delete-account";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMobilePlayLabels, getMobileTabLabels } from "../tab-labels";
import { LanguageRow, ToggleRow } from "./settings-rows";
import pkg from "@/package.json";

// =============================================================================
// Screen «Настройки» (design «PlayTennis Screens», экран H).
// Grouped card-lists: Аккаунт · Уведомления (brand-green toggles) ·
// Приложение. «Выйти» is separated and painted danger; the app version
// closes the screen.
// =============================================================================

type Props = { params: Promise<{ locale: string }> };

export default async function MobileSettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("mobile");
  const tDel = await getTranslations("accountDeletion");
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let prefs = { email: true, telegram: false, whatsapp: false };
  if (user) {
    const { data } = (await supabase
      .from("profiles")
      .select("notification_email, notification_telegram, notification_whatsapp")
      .eq("id", user.id)
      .maybeSingle()) as {
      data: {
        notification_email: boolean;
        notification_telegram: boolean;
        notification_whatsapp: boolean;
      } | null;
    };
    if (data) {
      prefs = {
        email: data.notification_email,
        telegram: data.notification_telegram,
        whatsapp: data.notification_whatsapp,
      };
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <MSubHeader title={t("settings.title")} backHref="/m/more" backLabel={t("common.back")} />

      <MContent className="flex-1 pt-4">
        {!user ? (
          <MEmptyState
            title={t("common.login_required_title")}
            body={t("common.login_required_body")}
            cta={t("common.login")}
            href="/login"
          />
        ) : (
          <div className="space-y-5">
            <div>
              <MEyebrow className="mb-2">{t("settings.group_account")}</MEyebrow>
              <ul className="space-y-[8px]">
                <LinkRow href="/me/profile" label={t("settings.profile")} icon={UserRound} />
                <LinkRow href="/privacy" label={t("settings.privacy")} icon={ShieldCheck} />
              </ul>
            </div>

            <div>
              <MEyebrow className="mb-2">{t("settings.group_notifications")}</MEyebrow>
              <div className="space-y-[8px]">
                <ToggleRow
                  channel="email"
                  label={t("settings.channel_email")}
                  initial={prefs.email}
                  icon={<Mail className="h-[17px] w-[17px]" strokeWidth={1.8} />}
                />
                <ToggleRow
                  channel="telegram"
                  label={t("settings.channel_telegram")}
                  initial={prefs.telegram}
                  icon={<Send className="h-[17px] w-[17px]" strokeWidth={1.8} />}
                />
                <ToggleRow
                  channel="whatsapp"
                  label={t("settings.channel_whatsapp")}
                  initial={prefs.whatsapp}
                  icon={<MessageCircle className="h-[17px] w-[17px]" strokeWidth={1.8} />}
                />
              </div>
            </div>

            <div>
              <MEyebrow className="mb-2">{t("settings.group_app")}</MEyebrow>
              <div className="space-y-[8px]">
                <LanguageRow label={t("settings.language")} />
                <LinkRow href="/support" label={t("settings.support")} icon={HelpCircle} />
              </div>
            </div>

            <form action="/api/auth/signout" method="post" className="pt-1">
              <button
                type="submit"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-[15px] border border-clay-200 bg-white font-display text-[14px] font-bold text-clay-500 transition-opacity active:opacity-85"
              >
                <LogOut className="h-4 w-4" strokeWidth={2} />
                {t("settings.logout")}
              </button>
            </form>

            <DeleteAccountSection
              variant="row"
              redirectTo={`/${locale}/m?account_deleted=1`}
              copy={{
                trigger: tDel("trigger"),
                card_title: tDel("card_title"),
                card_body: tDel("card_body"),
                dialog_title: tDel("dialog_title"),
                dialog_warning: tDel("dialog_warning"),
                consequences: [
                  tDel("consequence_login"),
                  tDel("consequence_profile"),
                  tDel("consequence_personal"),
                  tDel("consequence_history"),
                ],
                confirm_hint: tDel("confirm_hint", { word: tDel("confirm_word") }),
                confirm_word: tDel("confirm_word"),
                cancel: tDel("cancel"),
                confirm_cta: tDel("confirm_cta"),
                deleting: tDel("deleting"),
                blocked_title: tDel("blocked_title"),
                blocked_body: tDel("blocked_body"),
                blocked_clubs_label: tDel("blocked_clubs_label"),
                blocked_tournaments_label: tDel("blocked_tournaments_label"),
                error_generic: tDel("error_generic"),
              }}
            />
          </div>
        )}

        <p className="mt-5 text-center text-[10.5px] font-semibold text-[#A7B5A9]">
          {t("more.version", { version: pkg.version })}
        </p>
      </MContent>

      <MTabBar labels={getMobileTabLabels(t)} playLabels={getMobilePlayLabels(t)} authed={!!user} />
    </div>
  );
}

function LinkRow({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  return (
    <li className="list-none">
      <Link
        href={href as never}
        className="flex items-center gap-3 rounded-[15px] border border-[rgba(20,60,30,0.06)] bg-white p-[11px] shadow-[0_1px_2px_rgba(20,60,30,0.04)] transition-opacity active:opacity-85"
      >
        <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[11px] bg-pt-icon text-grass-600">
          <Icon className="h-[17px] w-[17px]" strokeWidth={1.8} />
        </span>
        <span className="flex-1 truncate font-display text-[14.5px] font-bold text-ink-900">
          {label}
        </span>
        <ChevronRight className="h-[16px] w-[16px] shrink-0 text-[#A7B5A9]" strokeWidth={2} />
      </Link>
    </li>
  );
}
