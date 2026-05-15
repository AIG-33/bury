/**
 * Locale-aware email templates for the outbox.
 *
 * Each template is a pure function: payload → { subject, html }.
 * Templates are intentionally simple HTML (no external assets) so they render
 * predictably across mail clients and survive aggressive mail-server stripping.
 *
 * Supported locales: ru (default), en.
 */

export type Locale = "ru" | "en";

export type TemplateCode =
  | "invitation_created"
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_reminder_24h"
  | "tournament_registered"
  | "tournament_application_submitted"
  | "tournament_application_approved"
  | "tournament_application_rejected"
  | "tournament_starting_24h"
  | "match_proposal"
  | "match_accepted"
  | "match_confirmed"
  | "match_disputed"
  | "rating_changed"
  | "season_summary"
  | "club_application_submitted"
  | "club_application_approved"
  | "club_application_rejected"
  | "club_member_kicked"
  | "club_ownership_offered";

export type RenderedEmail = { subject: string; html: string };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function shell(title: string, body: string, footer: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escape(title)}</title></head>
<body style="font-family:-apple-system,Segoe UI,Inter,system-ui,sans-serif;background:#f8faf6;margin:0;padding:24px;color:#111827">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#16a34a 0%,#facc15 100%);padding:18px 24px;color:#fff">
      <div style="font-weight:700;font-size:18px;letter-spacing:.4px">🎾 PlayTennis.by</div>
    </div>
    <div style="padding:24px">${body}</div>
    <div style="padding:14px 24px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px">${footer}</div>
  </div>
</body></html>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function btn(href: string, label: string): string {
  return `<a href="${escape(href)}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600">${escape(label)}</a>`;
}

function fmtDate(iso: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Europe/Minsk",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Per-template strings (subjects + body).
// ---------------------------------------------------------------------------

type Strings = {
  invitation_created: { subject: string; intro: string; cta: string; ps: string };
  booking_confirmed: { subject: string; intro: string; venue: string; cta: string; ps: string };
  booking_cancelled: { subject: string; intro: string; rescheduleCta: string };
  booking_reminder_24h: { subject: string; intro: string; venue: string };
  tournament_registered: { subject: string; intro: string; format: string; cta: string };
  tournament_application_submitted: { subject: string; intro: string; cta: string };
  tournament_application_approved: { subject: string; intro: string; format: string; cta: string };
  tournament_application_rejected: { subject: string; intro: string };
  tournament_starting_24h: { subject: string; intro: string; cta: string };
  match_proposal: { subject: string; intro: string; cta: string; declineHint: string };
  match_accepted: { subject: string; intro: string; cta: string; whatsappHint: string };
  match_confirmed: { subject: string; intro: string };
  match_disputed: { subject: string; intro: string };
  rating_changed: { subject: string; intro: string; eloLabel: string; deltaLabel: string };
  season_summary: { subject: string; intro: string; cta: string };
  club_application_submitted: { subject: string; intro: string; cta: string };
  club_application_approved: { subject: string; intro: string; cta: string };
  club_application_rejected: { subject: string; intro: string };
  club_member_kicked: { subject: string; intro: string };
  club_ownership_offered: { subject: string; intro: string; cta: string; ps: string };
  footer: string;
};

const COPY: Record<Locale, Strings> = {
  en: {
    invitation_created: {
      subject: "Your invitation to PlayTennis.by 🎾",
      intro:
        "Coach {coach} invited you to their club on PlayTennis.by — the open amateur-tennis platform of Belarus. Click below to create your account and start booking matches, coaches and tournaments.",
      cta: "Accept invitation",
      ps: "Link expires in 14 days. Ignore this email if it was sent by mistake.",
    },
    booking_confirmed: {
      subject: "Booking confirmed ✅",
      intro: "You booked a session on {when}.",
      venue: "Venue: {venue} ({court})",
      cta: "Open bookings",
      ps: "You can cancel up to 12 h before the session in your bookings page.",
    },
    booking_cancelled: {
      subject: "Booking cancelled",
      intro: "Your booking on {when} was cancelled.",
      rescheduleCta: "Find another slot",
    },
    booking_reminder_24h: {
      subject: "Reminder: training tomorrow 🎾",
      intro: "You have a session tomorrow: {when}.",
      venue: "Venue: {venue} ({court}). See you on court!",
    },
    tournament_registered: {
      subject: "You're in the draw 🏆",
      intro: "You registered for «{tournament}». Starts {when}.",
      format: "Format: {format}. Match rules: {rules}.",
      cta: "Open tournament",
    },
    tournament_application_submitted: {
      subject: "New tournament application 📨",
      intro:
        "Someone applied to your tournament «{tournament}». Review the application and approve or reject it.",
      cta: "Review applications",
    },
    tournament_application_approved: {
      subject: "You're in the tournament 🏆",
      intro: "Your application to «{tournament}» has been approved. Starts {when}.",
      format: "Format: {format}. Match rules: {rules}.",
      cta: "Open tournament",
    },
    tournament_application_rejected: {
      subject: "Tournament application not approved",
      intro:
        "Your application to «{tournament}» wasn't approved this time. Don't take it personally — try other open tournaments.",
    },
    tournament_starting_24h: {
      subject: "Tournament starts tomorrow!",
      intro: "Get your racket ready — «{tournament}» starts {when}.",
      cta: "View bracket",
    },
    match_proposal: {
      subject: "New match proposal from {opponent}",
      intro: "{opponent} (Elo {elo}) wants to play you. {message}",
      cta: "View proposal",
      declineHint: "You can decline in one click.",
    },
    match_accepted: {
      subject: "{opponent} accepted your match",
      intro:
        "Good news — {opponent} accepted your proposal. Coordinate the venue and time, play, and don't forget to log the score.",
      cta: "Open match",
      whatsappHint:
        "Tip: open the match page — there's a one-tap WhatsApp button to message your opponent.",
    },
    match_confirmed: {
      subject: "Match score confirmed — Elo updated",
      intro: "Your match vs {opponent} is confirmed. New Elo: {newElo} ({deltaSign}{delta}).",
    },
    match_disputed: {
      subject: "Disputed match score — coach review",
      intro: "Score for your match vs {opponent} is disputed. The coach will review.",
    },
    rating_changed: {
      subject: "Your Elo: {newElo} ({deltaSign}{delta})",
      intro: "After your last match your Elo has changed.",
      eloLabel: "New Elo",
      deltaLabel: "Change",
    },
    season_summary: {
      subject: "Season wrap-up",
      intro: "The season is over. Check your standings.",
      cta: "See results",
    },
    club_application_submitted: {
      subject: "New club application 📨",
      intro: "{applicant} applied to join your club «{club}». {message}",
      cta: "Review application",
    },
    club_application_approved: {
      subject: "You're in the club ✅",
      intro: "Your application to «{club}» has been approved. Welcome!",
      cta: "Open club",
    },
    club_application_rejected: {
      subject: "Club application not approved",
      intro: "Your application to «{club}» wasn't approved this time. {reason}",
    },
    club_member_kicked: {
      subject: "Club membership ended",
      intro: "You are no longer a member of «{club}». {reason}",
    },
    club_ownership_offered: {
      subject: "Club ownership offer 🎾",
      intro:
        "{previous} offered you ownership of the club «{club}». Accept within 14 days, otherwise the offer expires.",
      cta: "Open club",
      ps: "If you accept, you become the new owner and the previous owner stays as a co-admin.",
    },
    footer:
      "You're getting this because you're registered on PlayTennis.by. Change your preferences in profile settings.",
  },
  ru: {
    invitation_created: {
      subject: "Приглашение в PlayTennis.by 🎾",
      intro:
        "Тренер {coach} пригласил тебя в свой клуб на PlayTennis.by — открытой платформе для любителей тенниса в Беларуси. Жми кнопку ниже — создай аккаунт, и сразу можно искать спарринг, записываться к тренеру или в турнир.",
      cta: "Принять приглашение",
      ps: "Ссылка действительна 14 дней. Если письмо пришло по ошибке — игнорируй.",
    },
    booking_confirmed: {
      subject: "Запись подтверждена ✅",
      intro: "Ты записан на тренировку: {when}.",
      venue: "Место: {venue} ({court})",
      cta: "Открыть мои записи",
      ps: "Отменить можно не позднее чем за 12 ч до начала.",
    },
    booking_cancelled: {
      subject: "Запись отменена",
      intro: "Запись {when} отменена.",
      rescheduleCta: "Найти другой слот",
    },
    booking_reminder_24h: {
      subject: "Напоминание: тренировка завтра 🎾",
      intro: "Завтра тренировка: {when}.",
      venue: "Место: {venue} ({court}). До встречи на корте!",
    },
    tournament_registered: {
      subject: "Ты в турнире 🏆",
      intro: "Ты записан на турнир «{tournament}». Старт: {when}.",
      format: "Формат: {format}. Регламент матча: {rules}.",
      cta: "Открыть турнир",
    },
    tournament_application_submitted: {
      subject: "Новая заявка на турнир 📨",
      intro:
        "Кто-то подал заявку на твой турнир «{tournament}». Загляни и реши: одобрить или отклонить.",
      cta: "Открыть заявки",
    },
    tournament_application_approved: {
      subject: "Тебя одобрили в турнире 🏆",
      intro: "Твоя заявка на турнир «{tournament}» одобрена. Старт: {when}.",
      format: "Формат: {format}. Регламент матча: {rules}.",
      cta: "Открыть турнир",
    },
    tournament_application_rejected: {
      subject: "Заявка на турнир отклонена",
      intro:
        "Твою заявку на турнир «{tournament}» в этот раз не одобрили. Не переживай — попробуй другие открытые турниры.",
    },
    tournament_starting_24h: {
      subject: "Турнир стартует завтра!",
      intro: "Готовь ракетку — «{tournament}» стартует {when}.",
      cta: "Открыть сетку",
    },
    match_proposal: {
      subject: "Предложение матча от {opponent}",
      intro: "{opponent} (Эло {elo}) предлагает сыграть. {message}",
      cta: "Открыть предложение",
      declineHint: "Отказаться можно в один клик.",
    },
    match_accepted: {
      subject: "{opponent} принял твоё предложение",
      intro:
        "Хорошая новость — {opponent} принял твоё предложение матча. Согласуй время и площадку, сыграй и не забудь занести счёт.",
      cta: "Открыть матч",
      whatsappHint:
        "Подсказка: на странице матча есть кнопка «Написать в WhatsApp» — это самый быстрый способ договориться.",
    },
    match_confirmed: {
      subject: "Матч подтверждён — Эло обновлён",
      intro: "Матч против {opponent} подтверждён. Новый Эло: {newElo} ({deltaSign}{delta}).",
    },
    match_disputed: {
      subject: "Спорный счёт матча — нужна проверка",
      intro: "Счёт матча против {opponent} оспорен. Тренер примет решение.",
    },
    rating_changed: {
      subject: "Твой Эло: {newElo} ({deltaSign}{delta})",
      intro: "После последнего матча Эло обновился.",
      eloLabel: "Новый Эло",
      deltaLabel: "Изменение",
    },
    season_summary: {
      subject: "Итоги сезона",
      intro: "Сезон завершён. Посмотри своё место в рейтинге.",
      cta: "Открыть результаты",
    },
    club_application_submitted: {
      subject: "Новая заявка в клуб 📨",
      intro: "{applicant} подал заявку на вступление в клуб «{club}». {message}",
      cta: "Открыть заявку",
    },
    club_application_approved: {
      subject: "Тебя приняли в клуб ✅",
      intro: "Твоя заявка на вступление в клуб «{club}» одобрена. Добро пожаловать!",
      cta: "Открыть клуб",
    },
    club_application_rejected: {
      subject: "Заявка в клуб отклонена",
      intro: "Твою заявку в клуб «{club}» в этот раз не одобрили. {reason}",
    },
    club_member_kicked: {
      subject: "Тебя удалили из клуба",
      intro: "Ты больше не состоишь в клубе «{club}». {reason}",
    },
    club_ownership_offered: {
      subject: "Предложение стать владельцем клуба 🎾",
      intro:
        "{previous} предлагает тебе стать владельцем клуба «{club}». Прими предложение в течение 14 дней, иначе оно сгорит.",
      cta: "Открыть клуб",
      ps: "Если ты примешь — станешь новым владельцем, а текущий владелец станет со-администратором.",
    },
    footer:
      "Ты получаешь это письмо, потому что зарегистрирован на PlayTennis.by. Настроить уведомления можно в профиле.",
  },
};

function fill(s: string, vars: Record<string, string | number | undefined | null>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

// ---------------------------------------------------------------------------
// Telegram renderer — same `payload + locale` contract, but renders to plain
// text (with light HTML for bold/link, which Telegram understands via
// `parse_mode: HTML`). Returns null for templates we haven't wired for
// Telegram yet — the outbox treats that as "skip" rather than "fail".
// ---------------------------------------------------------------------------

export type RenderedTelegram = { text: string };

function tgEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function tgLink(href: string, label: string): string {
  return `<a href="${tgEscape(href)}">${tgEscape(label)}</a>`;
}

export function renderTelegram(
  code: TemplateCode,
  locale: Locale,
  payload: Payload,
): RenderedTelegram | null {
  const L = COPY[locale] ?? COPY.ru;
  switch (code) {
    case "match_proposal": {
      const t = L.match_proposal;
      const vars = {
        opponent: String(payload.opponent_name ?? ""),
        elo: String(payload.opponent_elo ?? ""),
        message: payload.message ? `«${String(payload.message)}»` : "",
      };
      const url = `${SITE}/${locale}/me/find/proposals`;
      return {
        text:
          `🎾 <b>${tgEscape(fill(t.subject, vars))}</b>\n\n` +
          `${tgEscape(fill(t.intro, vars))}\n\n` +
          `${tgLink(url, t.cta)}`,
      };
    }
    case "match_accepted": {
      const t = L.match_accepted;
      const vars = { opponent: String(payload.opponent_name ?? "") };
      const url = `${SITE}/${locale}/me/matches`;
      return {
        text:
          `✅ <b>${tgEscape(fill(t.subject, vars))}</b>\n\n` +
          `${tgEscape(fill(t.intro, vars))}\n\n` +
          `${tgLink(url, t.cta)}`,
      };
    }
    // Other templates fall through to "not wired for Telegram yet".
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Public renderer.
// ---------------------------------------------------------------------------

export type Payload = Record<string, string | number | boolean | null | undefined>;

export function renderTemplate(
  code: TemplateCode,
  locale: Locale,
  payload: Payload,
): RenderedEmail {
  const L = COPY[locale] ?? COPY.ru;
  const ftr = L.footer;

  switch (code) {
    case "invitation_created": {
      const t = L.invitation_created;
      const vars = { coach: String(payload.coach_name ?? "Coach") };
      const url = String(payload.accept_url ?? `${SITE}/`);
      const subject = fill(t.subject, vars);
      const html = shell(
        subject,
        `<h2 style="margin:0 0 12px;font-size:20px">${escape(fill(t.subject, vars))}</h2>
         <p>${escape(fill(t.intro, vars))}</p>
         <p style="margin:18px 0">${btn(url, t.cta)}</p>
         <p style="color:#6b7280;font-size:13px">${escape(t.ps)}</p>`,
        ftr,
      );
      return { subject, html };
    }
    case "booking_confirmed": {
      const t = L.booking_confirmed;
      const vars = {
        when: payload.starts_at ? fmtDate(String(payload.starts_at), locale) : "",
        venue: String(payload.venue ?? ""),
        court: String(payload.court ?? ""),
      };
      const url = `${SITE}/${locale}/me/bookings`;
      const subject = t.subject;
      const html = shell(
        subject,
        `<h2 style="margin:0 0 12px;font-size:20px">${escape(subject)}</h2>
         <p>${escape(fill(t.intro, vars))}</p>
         <p>${escape(fill(t.venue, vars))}</p>
         <p style="margin:18px 0">${btn(url, t.cta)}</p>
         <p style="color:#6b7280;font-size:13px">${escape(t.ps)}</p>`,
        ftr,
      );
      return { subject, html };
    }
    case "booking_cancelled": {
      const t = L.booking_cancelled;
      const vars = { when: payload.starts_at ? fmtDate(String(payload.starts_at), locale) : "" };
      const url = `${SITE}/${locale}/me/bookings`;
      const html = shell(
        t.subject,
        `<h2 style="margin:0 0 12px;font-size:20px">${escape(t.subject)}</h2>
         <p>${escape(fill(t.intro, vars))}</p>
         <p style="margin:18px 0">${btn(url, t.rescheduleCta)}</p>`,
        ftr,
      );
      return { subject: t.subject, html };
    }
    case "booking_reminder_24h": {
      const t = L.booking_reminder_24h;
      const vars = {
        when: payload.starts_at ? fmtDate(String(payload.starts_at), locale) : "",
        venue: String(payload.venue ?? ""),
        court: String(payload.court ?? ""),
      };
      const html = shell(
        t.subject,
        `<h2 style="margin:0 0 12px;font-size:20px">${escape(t.subject)}</h2>
         <p>${escape(fill(t.intro, vars))}</p>
         <p>${escape(fill(t.venue, vars))}</p>`,
        ftr,
      );
      return { subject: t.subject, html };
    }
    case "tournament_registered": {
      const t = L.tournament_registered;
      const vars = {
        tournament: String(payload.tournament_name ?? ""),
        when: payload.starts_at ? fmtDate(String(payload.starts_at), locale) : "TBD",
        format: String(payload.format ?? ""),
        rules: String(payload.rules ?? ""),
      };
      const url = `${SITE}/${locale}/tournaments/${payload.tournament_id ?? ""}`;
      const subject = t.subject;
      const html = shell(
        subject,
        `<h2 style="margin:0 0 12px;font-size:20px">🏆 ${escape(subject)}</h2>
         <p>${escape(fill(t.intro, vars))}</p>
         <p style="color:#6b7280">${escape(fill(t.format, vars))}</p>
         <p style="margin:18px 0">${btn(url, t.cta)}</p>`,
        ftr,
      );
      return { subject, html };
    }
    case "tournament_application_submitted": {
      const t = L.tournament_application_submitted;
      const vars = {
        tournament: String(payload.tournament_name ?? ""),
      };
      const url = `${SITE}/${locale}/me/tournaments/organized/${payload.tournament_id ?? ""}`;
      const subject = t.subject;
      const html = shell(
        subject,
        `<h2 style="margin:0 0 12px;font-size:20px">📨 ${escape(subject)}</h2>
         <p>${escape(fill(t.intro, vars))}</p>
         <p style="margin:18px 0">${btn(url, t.cta)}</p>`,
        ftr,
      );
      return { subject, html };
    }
    case "tournament_application_approved": {
      const t = L.tournament_application_approved;
      const vars = {
        tournament: String(payload.tournament_name ?? ""),
        when: payload.starts_at ? fmtDate(String(payload.starts_at), locale) : "TBD",
        format: String(payload.format ?? ""),
        rules: String(payload.rules ?? ""),
      };
      const url = `${SITE}/${locale}/tournaments/${payload.tournament_id ?? ""}`;
      const subject = t.subject;
      const html = shell(
        subject,
        `<h2 style="margin:0 0 12px;font-size:20px">🏆 ${escape(subject)}</h2>
         <p>${escape(fill(t.intro, vars))}</p>
         <p style="color:#6b7280">${escape(fill(t.format, vars))}</p>
         <p style="margin:18px 0">${btn(url, t.cta)}</p>`,
        ftr,
      );
      return { subject, html };
    }
    case "tournament_application_rejected": {
      const t = L.tournament_application_rejected;
      const vars = {
        tournament: String(payload.tournament_name ?? ""),
      };
      const subject = t.subject;
      const html = shell(
        subject,
        `<h2 style="margin:0 0 12px;font-size:20px">${escape(subject)}</h2>
         <p>${escape(fill(t.intro, vars))}</p>`,
        ftr,
      );
      return { subject, html };
    }
    case "tournament_starting_24h": {
      const t = L.tournament_starting_24h;
      const vars = {
        tournament: String(payload.tournament_name ?? ""),
        when: payload.starts_at ? fmtDate(String(payload.starts_at), locale) : "",
      };
      const url = `${SITE}/${locale}/tournaments/${payload.tournament_id ?? ""}`;
      const html = shell(
        t.subject,
        `<h2 style="margin:0 0 12px;font-size:20px">${escape(t.subject)}</h2>
         <p>${escape(fill(t.intro, vars))}</p>
         <p style="margin:18px 0">${btn(url, t.cta)}</p>`,
        ftr,
      );
      return { subject: t.subject, html };
    }
    case "match_proposal": {
      const t = L.match_proposal;
      const vars = {
        opponent: String(payload.opponent_name ?? ""),
        elo: String(payload.opponent_elo ?? ""),
        message: payload.message ? `«${String(payload.message)}»` : "",
      };
      const url = `${SITE}/${locale}/me/matches`;
      const subject = fill(t.subject, vars);
      const html = shell(
        subject,
        `<h2 style="margin:0 0 12px;font-size:20px">${escape(subject)}</h2>
         <p>${escape(fill(t.intro, vars))}</p>
         <p style="margin:18px 0">${btn(url, t.cta)}</p>
         <p style="color:#6b7280;font-size:13px">${escape(t.declineHint)}</p>`,
        ftr,
      );
      return { subject, html };
    }
    case "match_accepted": {
      const t = L.match_accepted;
      const vars = {
        opponent: String(payload.opponent_name ?? ""),
      };
      const url = `${SITE}/${locale}/me/matches`;
      const subject = fill(t.subject, vars);
      const html = shell(
        subject,
        `<h2 style="margin:0 0 12px;font-size:20px">${escape(subject)}</h2>
         <p>${escape(fill(t.intro, vars))}</p>
         <p style="margin:18px 0">${btn(url, t.cta)}</p>
         <p style="color:#6b7280;font-size:13px">${escape(t.whatsappHint)}</p>`,
        ftr,
      );
      return { subject, html };
    }
    case "match_confirmed": {
      const t = L.match_confirmed;
      const delta = Number(payload.delta ?? 0);
      const vars = {
        opponent: String(payload.opponent_name ?? ""),
        newElo: String(payload.new_elo ?? ""),
        delta: Math.abs(delta).toFixed(0),
        deltaSign: delta >= 0 ? "+" : "−",
      };
      const html = shell(
        t.subject,
        `<h2 style="margin:0 0 12px;font-size:20px">${escape(t.subject)}</h2>
         <p>${escape(fill(t.intro, vars))}</p>`,
        ftr,
      );
      return { subject: t.subject, html };
    }
    case "match_disputed": {
      const t = L.match_disputed;
      const vars = { opponent: String(payload.opponent_name ?? "") };
      const html = shell(
        t.subject,
        `<h2 style="margin:0 0 12px;font-size:20px">${escape(t.subject)}</h2>
         <p>${escape(fill(t.intro, vars))}</p>`,
        ftr,
      );
      return { subject: t.subject, html };
    }
    case "rating_changed": {
      const t = L.rating_changed;
      const delta = Number(payload.delta ?? 0);
      const vars = {
        newElo: String(payload.new_elo ?? ""),
        delta: Math.abs(delta).toFixed(0),
        deltaSign: delta >= 0 ? "+" : "−",
      };
      const subject = fill(t.subject, vars);
      const html = shell(
        subject,
        `<h2 style="margin:0 0 12px;font-size:20px">${escape(subject)}</h2>
         <p>${escape(t.intro)}</p>
         <p><strong>${escape(t.eloLabel)}</strong>: ${escape(vars.newElo)}<br/>
            <strong>${escape(t.deltaLabel)}</strong>: ${escape(vars.deltaSign + vars.delta)}</p>`,
        ftr,
      );
      return { subject, html };
    }
    case "season_summary": {
      const t = L.season_summary;
      const url = `${SITE}/${locale}/me/rating`;
      const html = shell(
        t.subject,
        `<h2 style="margin:0 0 12px;font-size:20px">${escape(t.subject)}</h2>
         <p>${escape(t.intro)}</p>
         <p style="margin:18px 0">${btn(url, t.cta)}</p>`,
        ftr,
      );
      return { subject: t.subject, html };
    }
    case "club_application_submitted": {
      const t = L.club_application_submitted;
      const vars = {
        applicant: String(payload.applicant_name ?? ""),
        club: String(payload.club_name ?? ""),
        message: payload.message ? `«${String(payload.message)}»` : "",
      };
      const url = `${SITE}/${locale}/me/clubs/owned/${payload.club_id ?? ""}`;
      const subject = t.subject;
      const html = shell(
        subject,
        `<h2 style="margin:0 0 12px;font-size:20px">📨 ${escape(subject)}</h2>
         <p>${escape(fill(t.intro, vars))}</p>
         <p style="margin:18px 0">${btn(url, t.cta)}</p>`,
        ftr,
      );
      return { subject, html };
    }
    case "club_application_approved": {
      const t = L.club_application_approved;
      const vars = { club: String(payload.club_name ?? "") };
      const url = `${SITE}/${locale}/clubs/${payload.club_slug ?? ""}`;
      const subject = t.subject;
      const html = shell(
        subject,
        `<h2 style="margin:0 0 12px;font-size:20px">✅ ${escape(subject)}</h2>
         <p>${escape(fill(t.intro, vars))}</p>
         <p style="margin:18px 0">${btn(url, t.cta)}</p>`,
        ftr,
      );
      return { subject, html };
    }
    case "club_application_rejected": {
      const t = L.club_application_rejected;
      const vars = {
        club: String(payload.club_name ?? ""),
        reason: payload.reason ? `«${String(payload.reason)}»` : "",
      };
      const subject = t.subject;
      const html = shell(
        subject,
        `<h2 style="margin:0 0 12px;font-size:20px">${escape(subject)}</h2>
         <p>${escape(fill(t.intro, vars))}</p>`,
        ftr,
      );
      return { subject, html };
    }
    case "club_member_kicked": {
      const t = L.club_member_kicked;
      const vars = {
        club: String(payload.club_name ?? ""),
        reason: payload.reason ? `«${String(payload.reason)}»` : "",
      };
      const subject = t.subject;
      const html = shell(
        subject,
        `<h2 style="margin:0 0 12px;font-size:20px">${escape(subject)}</h2>
         <p>${escape(fill(t.intro, vars))}</p>`,
        ftr,
      );
      return { subject, html };
    }
    case "club_ownership_offered": {
      const t = L.club_ownership_offered;
      const vars = {
        previous: String(payload.previous_owner_name ?? ""),
        club: String(payload.club_name ?? ""),
      };
      const url = `${SITE}/${locale}/me/clubs`;
      const subject = t.subject;
      const html = shell(
        subject,
        `<h2 style="margin:0 0 12px;font-size:20px">🎾 ${escape(subject)}</h2>
         <p>${escape(fill(t.intro, vars))}</p>
         <p style="margin:18px 0">${btn(url, t.cta)}</p>
         <p style="color:#6b7280;font-size:13px">${escape(t.ps)}</p>`,
        ftr,
      );
      return { subject, html };
    }
  }
}
