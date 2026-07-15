import { describe, expect, it } from "vitest";
import {
  UserVenueFormSchema,
  VenueCommentSchema,
  VENUE_COMMENT_MAX,
} from "../schema";

const baseVenue = {
  name: "Аква-Минск",
  city: "Минск",
  address: "пр. Победителей 120",
  lat: 53.938,
  lng: 27.488,
  amenities: ["parking", "shower"],
  website: "https://example.by",
  phone: "+375 29 111-22-33",
  photo_url: "",
  courts: [
    { number: 1, name: "Центральный", surface: "hard", is_indoor: true },
    { number: 2, name: "", surface: null, is_indoor: false },
  ],
};

describe("UserVenueFormSchema", () => {
  it("accepts a full valid payload and normalizes empty strings to null", () => {
    const r = UserVenueFormSchema.safeParse(baseVenue);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.photo_url).toBeNull();
    expect(r.data.courts[1].name).toBeNull();
    expect(r.data.website).toBe("https://example.by");
  });

  it("accepts the minimal payload (name only)", () => {
    const r = UserVenueFormSchema.safeParse({ name: "Корт у дома" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.courts).toEqual([]);
    expect(r.data.amenities).toEqual([]);
    expect(r.data.lat).toBeNull();
    expect(r.data.website).toBeNull();
  });

  it("rejects a too-short name", () => {
    const r = UserVenueFormSchema.safeParse({ ...baseVenue, name: "A" });
    expect(r.success).toBe(false);
  });

  it("rejects out-of-range coordinates", () => {
    expect(UserVenueFormSchema.safeParse({ ...baseVenue, lat: 91 }).success).toBe(false);
    expect(UserVenueFormSchema.safeParse({ ...baseVenue, lng: -181 }).success).toBe(false);
  });

  it("coerces string form inputs for lat/lng and court numbers", () => {
    const r = UserVenueFormSchema.safeParse({
      ...baseVenue,
      lat: "53.9",
      lng: "27.5",
      courts: [{ number: "3", name: null, surface: "clay", is_indoor: false }],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.lat).toBeCloseTo(53.9);
    expect(r.data.courts[0].number).toBe(3);
  });

  it("rejects a website without an http(s) scheme", () => {
    const r = UserVenueFormSchema.safeParse({ ...baseVenue, website: "example.by" });
    expect(r.success).toBe(false);
  });

  it("treats an empty website as null", () => {
    const r = UserVenueFormSchema.safeParse({ ...baseVenue, website: "" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.website).toBeNull();
  });

  it("rejects duplicate court numbers", () => {
    const r = UserVenueFormSchema.safeParse({
      ...baseVenue,
      courts: [
        { number: 1, name: null, surface: null, is_indoor: false },
        { number: 1, name: null, surface: null, is_indoor: true },
      ],
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues.some((i) => i.message === "duplicate_court_numbers")).toBe(true);
  });

  it("rejects an unknown surface", () => {
    const r = UserVenueFormSchema.safeParse({
      ...baseVenue,
      courts: [{ number: 1, name: null, surface: "sand", is_indoor: false }],
    });
    expect(r.success).toBe(false);
  });

  it("keeps existing court ids in the edit flow", () => {
    const r = UserVenueFormSchema.safeParse({
      ...baseVenue,
      courts: [
        {
          id: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
          number: 1,
          name: null,
          surface: "hard",
          is_indoor: true,
        },
      ],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.courts[0].id).toBe("6f9619ff-8b86-4d01-b42d-00cf4fc964ff");
  });

  it("rejects a non-https photo url", () => {
    const r = UserVenueFormSchema.safeParse({
      ...baseVenue,
      photo_url: "http://insecure.example/x.jpg",
    });
    expect(r.success).toBe(false);
  });
});

describe("VenueCommentSchema", () => {
  const venueId = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";

  it("accepts a normal comment and trims it", () => {
    const r = VenueCommentSchema.safeParse({
      venue_id: venueId,
      body: "  Телефон на сайте не отвечает.  ",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.body).toBe("Телефон на сайте не отвечает.");
  });

  it("rejects a too-short comment", () => {
    expect(VenueCommentSchema.safeParse({ venue_id: venueId, body: "ok" }).success).toBe(false);
  });

  it("rejects an over-limit comment", () => {
    const r = VenueCommentSchema.safeParse({
      venue_id: venueId,
      body: "x".repeat(VENUE_COMMENT_MAX + 1),
    });
    expect(r.success).toBe(false);
  });

  it("rejects a non-uuid venue id", () => {
    expect(VenueCommentSchema.safeParse({ venue_id: "nope", body: "valid body" }).success).toBe(
      false,
    );
  });
});
