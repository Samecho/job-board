import { describe, expect, it } from "vitest";
import { matchesLocationFilter } from "./locationFilter";
import { SOFTWARE_HIRING_SITES } from "../data/softwareHiringSites";
import { COMPANY_CATALOG } from "../data/catalog";

describe("SWE recruiting location filter", () => {
  it("matches the country and all five locations in RBC's developer program", () => {
    const company = { name: "RBC" };
    for (const location of ["Canada", "Toronto", "Montreal", "Vancouver", "Halifax", "Calgary"]) {
      expect(matchesLocationFilter(company, location)).toBe(true);
    }
    expect(matchesLocationFilter(company, "Ottawa")).toBe(false);
  });

  it("matches case and accents without treating company names as locations", () => {
    expect(matchesLocationFilter({ name: "RBC" }, " montréal ")).toBe(true);
    expect(matchesLocationFilter({ name: "Canada Example" }, "Canada")).toBe(false);
    expect(matchesLocationFilter({ name: "Atlassian" }, "vancouver")).toBe(true);
  });

  it("matches each city on the Huawei Canada recruiting board", () => {
    for (const city of ["Edmonton", "Kingston", "Markham", "Montreal", "Ottawa", "Vancouver", "Waterloo"]) {
      expect(matchesLocationFilter({ name: "Huawei" }, city)).toBe(true);
    }
  });

  it("does not infer SWE hiring from an unverified saved location or ordinary office", () => {
    const company = { name: "Unknown", main_locations: "Toronto, Canada" };
    expect(matchesLocationFilter(company, "Canada")).toBe(false);
    expect(matchesLocationFilter(company, "Toronto")).toBe(false);
    expect(matchesLocationFilter(company, " ")).toBe(true);
  });

  it("links every recorded company and location to a catalog entry and an evidence source", () => {
    const companies = new Set(COMPANY_CATALOG.map(company => company.name));
    for (const [name, groups] of Object.entries(SOFTWARE_HIRING_SITES)) {
      expect(companies.has(name), name).toBe(true);
      for (const group of groups) {
        expect(group.source).toMatch(/^https:\/\//);
        expect(group.locations.length).toBeGreaterThan(0);
        expect(group.locations.every(site => site.city && site.country)).toBe(true);
      }
    }
  });
});
