type Locale = "pl" | "en" | "ru";

const COPY: Record<
  Locale,
  { subject: (coach: string) => string; intro: (coach: string) => string; cta: string; outro: string; footer: string }
> = {
  pl: {
    subject: (c) => `${c} zaprasza Cię na Bury Tennis`,
    intro: (c) => `${c} zaprasza Cię do swojego klubu na platformie Bury Tennis. Po kliknięciu linku poniżej:`,
    cta: "Akceptuj zaproszenie",
    outro: "Link działa przez 14 dni i jest jednorazowy.",
    footer: "Aliaksandr Bury Tennis Platform — uniwersalny ranking dla amatorów tenisa.",
  },
  en: {
    subject: (c) => `${c} invited you to Bury Tennis`,
    intro: (c) =>
      `${c} invited you to their club on the Bury Tennis platform. When you click the link below:`,
    cta: "Accept invitation",
    outro: "The link is valid for 14 days and can be used once.",
    footer: "Aliaksandr Bury Tennis Platform — a universal ranking for amateur tennis.",
  },
  ru: {
    subject: (c) => `${c} приглашает тебя в Bury Tennis`,
    intro: (c) =>
      `${c} приглашает тебя в свой клуб на платформе Bury Tennis. После клика по ссылке ниже:`,
    cta: "Принять приглашение",
    outro: "Ссылка работает 14 дней и одноразовая.",
    footer: "Aliaksandr Bury Tennis Platform — универсальный рейтинг для любителей тенниса.",
  },
};

const STEPS_BY_LOCALE: Record<Locale, string[]> = {
  pl: [
    "1. Założysz konto (e-mail / Google).",
    "2. Przejdziesz krótki quiz, który ustali Twój początkowy ranking Elo.",
    "3. Trafisz na pulpit gracza i będziesz mógł umawiać mecze.",
  ],
  en: [
    "1. You'll create an account (email / Google).",
    "2. You'll take a short quiz that sets your starting Elo rating.",
    "3. You'll land in your player dashboard and start matching.",
  ],
  ru: [
    "1. Создашь аккаунт (email / Google).",
    "2. Пройдёшь короткий квиз, который определит стартовый Elo.",
    "3. Окажешься в кабинете игрока и начнёшь искать соперников.",
  ],
};

export function buildInvitationEmail(opts: {
  coachName: string;
  acceptUrl: string;
  locale: Locale;
}) {
  const c = COPY[opts.locale];
  const steps = STEPS_BY_LOCALE[opts.locale];
  return {
    subject: c.subject(opts.coachName),
    html: `
<!doctype html>
<html lang="${opts.locale}">
<body style="margin:0;padding:0;background:#f4f6f5;font-family:Inter,Arial,sans-serif;color:#0f1b14;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:24px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;box-shadow:0 8px 24px rgba(15,27,20,.08);overflow:hidden;">
        <tr><td style="padding:32px 32px 0 32px;">
          <div style="display:inline-block;background:#EAF7EE;color:#155E36;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:600;">Bury Tennis</div>
          <h1 style="margin:16px 0 8px 0;font-size:26px;font-weight:700;color:#0f1b14;">${escapeHtml(c.subject(opts.coachName))}</h1>
          <p style="margin:0;font-size:15px;line-height:1.55;color:#445048;">${escapeHtml(c.intro(opts.coachName))}</p>
          <ol style="margin:16px 0 0 0;padding:0;list-style:none;font-size:14px;line-height:1.6;color:#445048;">
            ${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
          </ol>
        </td></tr>
        <tr><td style="padding:24px 32px 32px 32px;">
          <a href="${opts.acceptUrl}" style="display:inline-block;background:#1F8A4C;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 24px;border-radius:12px;">${escapeHtml(c.cta)}</a>
          <p style="margin:16px 0 0 0;font-size:12px;color:#8C988F;">${escapeHtml(c.outro)}</p>
        </td></tr>
        <tr><td style="background:#EAF7EE;padding:18px 32px;font-size:11px;color:#5B6A60;">${escapeHtml(c.footer)}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `.trim(),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
