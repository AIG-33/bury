type Locale = "pl" | "en" | "ru";

const COPY: Record<
  Locale,
  {
    subject: (initiator: string) => string;
    title: (initiator: string) => string;
    intro: (initiator: string, elo: number) => string;
    note_label: string;
    cta: string;
    whatsapp_hint: string;
    footer: string;
  }
> = {
  pl: {
    subject: (n) => `${n} proponuje Ci mecz tenisowy`,
    title: (n) => `${n} chce z Tobą zagrać`,
    intro: (n, elo) =>
      `${n} (Elo ${elo}) zobaczył Twój profil w „Znajdź gracza\u201D i proponuje mecz towarzyski. Możesz zaakceptować lub odrzucić — albo od razu napisać na WhatsApp i dogadać szczegóły.`,
    note_label: "Wiadomość od inicjatora",
    cta: "Otwórz propozycję",
    whatsapp_hint:
      "Wskazówka: w Polsce najszybciej dogadać się przez WhatsApp. Na stronie propozycji znajdziesz przycisk „Napisz na WhatsApp\u201D.",
    footer: "Bury Tennis Platform — uniwersalny ranking dla amatorów tenisa.",
  },
  en: {
    subject: (n) => `${n} wants to play a tennis match with you`,
    title: (n) => `${n} proposed a match`,
    intro: (n, elo) =>
      `${n} (Elo ${elo}) found you in "Find a Player" and is proposing a friendly match. You can accept, decline, or just message them directly on WhatsApp.`,
    note_label: "Note from the initiator",
    cta: "Open proposal",
    whatsapp_hint:
      "Tip: in Poland WhatsApp is the fastest way to coordinate. The proposal page has a one-tap “Message on WhatsApp” button.",
    footer: "Bury Tennis Platform — a universal ranking for amateur tennis.",
  },
  ru: {
    subject: (n) => `${n} предлагает сыграть теннисный матч`,
    title: (n) => `${n} предлагает матч`,
    intro: (n, elo) =>
      `${n} (Elo ${elo}) нашёл тебя в «Найти игрока» и предлагает товарищеский матч. Можешь принять, отклонить — или сразу написать в WhatsApp и договориться.`,
    note_label: "Сообщение от инициатора",
    cta: "Открыть предложение",
    whatsapp_hint:
      "Подсказка: в Польше быстрее всего договариваться через WhatsApp. На странице предложения есть кнопка «Написать в WhatsApp».",
    footer: "Bury Tennis Platform — универсальный рейтинг для любителей тенниса.",
  },
};

export function buildMatchProposalEmail(opts: {
  initiatorName: string;
  initiatorElo: number;
  message: string | null;
  proposalUrl: string;
  locale: Locale;
}) {
  const c = COPY[opts.locale];
  const messageBlock = opts.message
    ? `<div style="margin:16px 0;padding:14px 16px;background:#F4FAF6;border-left:3px solid #1F8A4C;border-radius:8px;">
         <p style="margin:0 0 4px 0;font-size:11px;font-weight:600;color:#5B6A60;text-transform:uppercase;letter-spacing:.04em;">${escapeHtml(c.note_label)}</p>
         <p style="margin:0;font-size:14px;line-height:1.55;color:#0f1b14;">${escapeHtml(opts.message)}</p>
       </div>`
    : "";

  return {
    subject: c.subject(opts.initiatorName),
    html: `
<!doctype html>
<html lang="${opts.locale}">
<body style="margin:0;padding:0;background:#f4f6f5;font-family:Inter,Arial,sans-serif;color:#0f1b14;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:24px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;box-shadow:0 8px 24px rgba(15,27,20,.08);overflow:hidden;">
        <tr><td style="padding:32px 32px 0 32px;">
          <div style="display:inline-block;background:#FEF6CC;color:#7A5C00;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:600;">🎾 Match proposal</div>
          <h1 style="margin:16px 0 8px 0;font-size:24px;font-weight:700;color:#0f1b14;">${escapeHtml(c.title(opts.initiatorName))}</h1>
          <p style="margin:0;font-size:15px;line-height:1.55;color:#445048;">${escapeHtml(c.intro(opts.initiatorName, opts.initiatorElo))}</p>
          ${messageBlock}
        </td></tr>
        <tr><td style="padding:8px 32px 24px 32px;">
          <a href="${opts.proposalUrl}" style="display:inline-block;background:#1F8A4C;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 24px;border-radius:12px;">${escapeHtml(c.cta)}</a>
          <p style="margin:16px 0 0 0;font-size:12px;line-height:1.55;color:#5B6A60;">${escapeHtml(c.whatsapp_hint)}</p>
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
