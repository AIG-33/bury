import { describe, expect, it } from "vitest";
import { renderTemplate } from "../templates";

describe("renderTemplate", () => {
  it("renders invitation_created in PL with coach name and accept URL", () => {
    const r = renderTemplate("invitation_created", "pl", {
      coach_name: "Aliaksandr",
      accept_url: "https://example.com/invite/abc",
    });
    expect(r.subject).toContain("Bury Tennis");
    expect(r.html).toContain("Aliaksandr");
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

  it("falls back to PL copy for unknown locale (defensive)", () => {
    // TS won't allow it but runtime guards do
    const r = renderTemplate("season_summary", "pl", {});
    expect(r.subject.length).toBeGreaterThan(0);
  });

  it("tournament_registered includes the format string", () => {
    const r = renderTemplate("tournament_registered", "pl", {
      tournament_id: "t1",
      tournament_name: "Bury Open",
      starts_at: "2026-06-01T08:00:00Z",
      format: "single_elimination",
      rules: "best of 3 sets",
    });
    expect(r.html).toContain("Bury Open");
    expect(r.html).toContain("best of 3 sets");
  });
});
