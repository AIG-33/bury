import { describe, it, expect } from "vitest";
import {
  DEFAULT_COUNTRY,
  PRIORITY_COUNTRIES,
  getAllCountryCodes,
  getCountryName,
  getCountryOptions,
  isValidCountryCode,
} from "../countries";

describe("getAllCountryCodes", () => {
  it("contains the priority countries and common ISO codes", () => {
    const codes = getAllCountryCodes();
    for (const c of PRIORITY_COUNTRIES) expect(codes).toContain(c);
    for (const c of ["US", "DE", "FR", "GE", "AM"]) expect(codes).toContain(c);
  });

  it("does not contain unassigned or meta codes", () => {
    const codes = getAllCountryCodes();
    for (const c of ["AA", "ZZ", "EU", "UN", "XX"]) expect(codes).not.toContain(c);
  });
});

describe("isValidCountryCode", () => {
  it("accepts real codes and rejects garbage", () => {
    expect(isValidCountryCode("BY")).toBe(true);
    expect(isValidCountryCode("PL")).toBe(true);
    expect(isValidCountryCode("ZZ")).toBe(false);
    expect(isValidCountryCode("by")).toBe(false);
    expect(isValidCountryCode("BYN")).toBe(false);
    expect(isValidCountryCode("")).toBe(false);
  });
});

describe("getCountryName", () => {
  it("localizes names per locale", () => {
    expect(getCountryName("BY", "ru")).toBe("Беларусь");
    expect(getCountryName("BY", "en")).toBe("Belarus");
    expect(getCountryName("PL", "ru")).toBe("Польша");
  });

  it("falls back to the raw code for unassigned values", () => {
    expect(getCountryName("XX", "ru")).toBe("XX");
  });
});

describe("getCountryOptions", () => {
  it("puts priority countries first, in the fixed order", () => {
    const options = getCountryOptions("ru");
    expect(options.slice(0, PRIORITY_COUNTRIES.length).map((o) => o.code)).toEqual([
      ...PRIORITY_COUNTRIES,
    ]);
    expect(options[0].code).toBe(DEFAULT_COUNTRY);
  });

  it("sorts the remaining countries alphabetically by localized name", () => {
    const options = getCountryOptions("ru");
    const rest = options.slice(PRIORITY_COUNTRIES.length);
    const names = rest.map((o) => o.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "ru"));
    expect(names).toEqual(sorted);
  });

  it("contains no duplicates and covers every known code", () => {
    const options = getCountryOptions("en");
    const codes = options.map((o) => o.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.length).toBe(getAllCountryCodes().length);
  });
});
