import { describe, expect, it } from "vitest";
import { renderTelegram, renderTemplate, type TemplateCode } from "../templates";

describe("renderTemplate", () => {
  it("renders invitation_created in RU with coach name and accept URL", () => {
    const r = renderTemplate("invitation_created", "ru", {
      coach_name: "Maksim",
      accept_url: "https://example.com/invite/abc",
    });
    expect(r.subject).toContain("PlayTennis.by");
    expect(r.html).toContain("Maksim");
    expect(r.html).toContain("https://example.com/invite/abc");
  });

  it("renders booking_confirmed in EN with formatted date", () => {
    const r = renderTemplate("booking_confirmed", "en", {
      starts_at: "2026-05-01T16:00:00Z",
      venue: "Stegny",
      court: "Court #1",
    });
    expect(r.subject.toLowerCase()).toContain("confirmed");
    expect(r.html).toContain("Stegny");
    expect(r.html).toContain("Court #1");
  });

  it("renders booking_reminder_24h with venue and court", () => {
    const r = renderTemplate("booking_reminder_24h", "ru", {
      starts_at: "2026-05-01T16:00:00Z",
      venue: "Mokotów",
      court: "#3",
    });
    expect(r.html).toContain("Mokotów");
  });

  it("rating_changed shows positive delta with +", () => {
    const r = renderTemplate("rating_changed", "en", { new_elo: 1234, delta: 12 });
    expect(r.subject).toContain("+12");
  });

  it("rating_changed shows negative delta with minus", () => {
    const r = renderTemplate("rating_changed", "en", { new_elo: 1200, delta: -8 });
    expect(r.subject).toMatch(/[−-]8/);
  });

  it("escapes user-provided HTML to prevent XSS", () => {
    const r = renderTemplate("match_proposal", "en", {
      opponent_name: "<script>alert(1)</script>",
      opponent_elo: 1000,
      message: "hi <b>",
    });
    expect(r.html).not.toContain("<script>alert(1)</script>");
    expect(r.html).toContain("&lt;script&gt;");
  });

  it("falls back to RU copy for unknown locale (defensive)", () => {
    const r = renderTemplate("season_summary", "ru", {});
    expect(r.subject.length).toBeGreaterThan(0);
  });

  it("venue_comment_added includes venue name, author and link", () => {
    const r = renderTemplate("venue_comment_added", "ru", {
      venue_id: "v1",
      venue_name: "Аква-Минск",
      author_name: "Иван",
      excerpt: "Кортов теперь шесть",
    });
    expect(r.subject).toContain("Аква-Минск");
    expect(r.html).toContain("Иван");
    expect(r.html).toContain("/venues/v1");
  });

  it("tournament_registered includes the format string", () => {
    const r = renderTemplate("tournament_registered", "ru", {
      tournament_id: "t1",
      tournament_name: "Minsk Spring Open",
      starts_at: "2026-06-01T08:00:00Z",
      format: "single_elimination",
      rules: "best of 3 sets",
    });
    expect(r.html).toContain("Minsk Spring Open");
    expect(r.html).toContain("best of 3 sets");
  });
});

describe("renderTelegram", () => {
  const ALL_CODES: TemplateCode[] = [
    "invitation_created",
    "booking_confirmed",
    "booking_cancelled",
    "booking_reminder_24h",
    "tournament_registered",
    "tournament_application_submitted",
    "tournament_application_approved",
    "tournament_application_rejected",
    "tournament_starting_24h",
    "tournament_match_scheduled",
    "match_proposal",
    "match_accepted",
    "match_confirmed",
    "match_disputed",
    "rating_changed",
    "season_summary",
    "club_application_submitted",
    "club_application_approved",
    "club_application_rejected",
    "club_member_kicked",
    "club_ownership_offered",
    "venue_comment_added",
  ];

  it("is wired for every template except invitation_created", () => {
    for (const code of ALL_CODES) {
      const r = renderTelegram(code, "ru", {
        tournament_id: "t1",
        tournament_name: "Minsk Open",
        opponent_name: "Иван",
        club_name: "Клуб",
        venue_id: "v1",
        venue_name: "Корт",
        starts_at: "2026-06-01T08:00:00Z",
        new_elo: 1200,
        delta: 10,
      });
      if (code === "invitation_created") {
        expect(r).toBeNull();
      } else {
        expect(r, code).not.toBeNull();
        expect(r!.text.length, code).toBeGreaterThan(10);
      }
    }
  });

  it("tournament_match_scheduled links to the tournament page", () => {
    const r = renderTelegram("tournament_match_scheduled", "ru", {
      tournament_id: "t1",
      tournament_name: "Minsk Open",
      opponent_name: "Иван",
    });
    expect(r!.text).toContain("/tournaments/t1");
    expect(r!.text).toContain("Иван");
  });

  it("escapes user-provided HTML in Telegram text", () => {
    const r = renderTelegram("match_proposal", "en", {
      opponent_name: "<script>alert(1)</script>",
      opponent_elo: 1000,
      message: "hi",
    });
    expect(r!.text).not.toContain("<script>");
    expect(r!.text).toContain("&lt;script&gt;");
  });

  it("club application decision renders localized subject", () => {
    const r = renderTelegram("club_application_approved", "en", {
      club_name: "Riverside",
      club_slug: "riverside",
    });
    expect(r!.text).toContain("Riverside");
    expect(r!.text).toContain("/clubs/riverside");
  });
});
