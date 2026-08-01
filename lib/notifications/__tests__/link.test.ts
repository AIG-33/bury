import { describe, expect, it } from "vitest";
import { notificationHref, toMobilePath } from "../link";

describe("notificationHref", () => {
  it("prefers explicit link_url", () => {
    expect(
      notificationHref({ template: "whatever", payload: {}, linkUrl: "/tournaments/t1" }),
    ).toBe("/tournaments/t1");
  });

  it("ignores non-path link_url (defensive)", () => {
    expect(
      notificationHref({
        template: "tournament_starting_24h",
        payload: { tournament_id: "t1" },
        linkUrl: "https://evil.example",
      }),
    ).toBe("/tournaments/t1");
  });

  it("derives tournament link from legacy payload", () => {
    expect(
      notificationHref({
        template: "tournament_match_scheduled",
        payload: { tournament_id: "t1" },
      }),
    ).toBe("/tournaments/t1");
  });

  it("routes organizer application alerts to the organized panel", () => {
    expect(
      notificationHref({
        template: "tournament_application_submitted",
        payload: { tournament_id: "t1" },
      }),
    ).toBe("/me/tournaments/organized/t1");
  });

  it("maps match / booking / club / venue templates", () => {
    expect(notificationHref({ template: "match_accepted", payload: {} })).toBe("/me/matches");
    expect(notificationHref({ template: "booking_reminder_24h", payload: {} })).toBe(
      "/me/bookings",
    );
    expect(
      notificationHref({ template: "club_application_approved", payload: { club_slug: "ace" } }),
    ).toBe("/clubs/ace");
    expect(notificationHref({ template: "venue_comment_added", payload: { venue_id: "v1" } })).toBe(
      "/venues/v1",
    );
  });

  it("returns null when there is nothing to link to", () => {
    expect(notificationHref({ template: "unknown_template", payload: {} })).toBeNull();
    expect(notificationHref({ template: "venue_comment_added", payload: {} })).toBeNull();
  });

  it("maps to /m twins in mobile mode", () => {
    expect(
      notificationHref({
        template: "tournament_match_scheduled",
        payload: {},
        linkUrl: "/tournaments/t1",
        mobile: true,
      }),
    ).toBe("/m/tournaments/t1");
    expect(notificationHref({ template: "match_accepted", payload: {}, mobile: true })).toBe(
      "/m/matches",
    );
    // No /m twin — keep the web path (it still renders on a phone).
    expect(notificationHref({ template: "booking_confirmed", payload: {}, mobile: true })).toBe(
      "/me/bookings",
    );
  });
});

describe("toMobilePath", () => {
  it("only rewrites known twins", () => {
    expect(toMobilePath("/tournaments/abc")).toBe("/m/tournaments/abc");
    expect(toMobilePath("/clubs/ace")).toBe("/m/clubs/ace");
    expect(toMobilePath("/me/rating")).toBe("/m/rating");
    expect(toMobilePath("/me/tournaments/organized/t1")).toBe("/me/tournaments/organized/t1");
  });
});
