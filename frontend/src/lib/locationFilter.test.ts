import { describe, expect, it } from "vitest";
import { matchesLocationFilter } from "./locationFilter";
import { NO_CANADA_SWE_MATCH_AUDITS, SOFTWARE_HIRING_SITES } from "../data/softwareHiringSites";
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

  it("matches locations from all Databricks 2027 software engineering intern postings", () => {
    for (const location of ["Vancouver", "Bellevue", "Mountain View", "San Francisco", "Aarhus", "Amsterdam", "Belgrade", "Berlin", "London", "Denmark", "United Kingdom"]) {
      expect(matchesLocationFilter({ name: "Databricks" }, location)).toBe(true);
    }
  });

  it("includes both cities from the Atlassian US internship detail", () => {
    expect(matchesLocationFilter({ name: "Atlassian" }, "Seattle")).toBe(true);
    expect(matchesLocationFilter({ name: "Atlassian" }, "San Francisco")).toBe(true);
  });

  it("distinguishes Cohere hybrid locations from remote job eligibility", () => {
    const groups = SOFTWARE_HIRING_SITES.Cohere;
    expect(groups[0].locations.map(site => site.city)).toEqual(["Toronto", "Montreal", "Ottawa"]);
    expect(groups[1].label).toMatch(/Remote/);
    expect(matchesLocationFilter({ name: "Cohere" }, "Vancouver")).toBe(true);
  });

  it("matches Cisco's potential co-op location alternatives without losing borough names", () => {
    for (const city of ["Calgary", "Halifax", "Kanata", "Montreal", "Ottawa", "Saint-Laurent", "Toronto", "Vancouver"]) {
      expect(matchesLocationFilter({ name: "Cisco" }, city)).toBe(true);
    }
    expect(SOFTWARE_HIRING_SITES.Cisco[0].label).toMatch(/Potential/);
  });

  it("matches Microsoft's audited Canadian software job location", () => {
    expect(matchesLocationFilter({ name: "Microsoft" }, "Canada")).toBe(true);
    expect(matchesLocationFilter({ name: "Microsoft" }, "Vancouver")).toBe(true);
  });

  it("includes each possible location named in Amazon's 2027 SDE internship posting", () => {
    for (const city of ["Vancouver", "Toronto", "Victoria", "Ottawa", "Calgary", "Winnipeg"]) {
      expect(matchesLocationFilter({ name: "Amazon" }, city)).toBe(true);
    }
  });

  it("matches the current AMD and Qualcomm development locations without inferring Ottawa", () => {
    for (const city of ["Markham", "Vancouver", "Waterloo", "Calgary"]) expect(matchesLocationFilter({ name: "AMD" }, city)).toBe(true);
    for (const city of ["Markham", "Toronto", "Vancouver"]) expect(matchesLocationFilter({ name: "Qualcomm" }, city)).toBe(true);
    expect(matchesLocationFilter({ name: "Qualcomm" }, "Ottawa")).toBe(false);
    expect(SOFTWARE_HIRING_SITES.Qualcomm[1].label).toMatch(/Remote/);
  });

  it("matches Bombardier's Saint-Laurent location by borough or Montreal", () => {
    for (const location of ["Dorval", "Saint-Laurent", "Montreal", "Mississauga"]) {
      expect(matchesLocationFilter({ name: "Bombardier" }, location)).toBe(true);
    }
  });

  it("keeps IBM's physical and remote recruiting locations distinct", () => {
    expect(SOFTWARE_HIRING_SITES.IBM[0].label).toMatch(/Onsite or hybrid/);
    expect(SOFTWARE_HIRING_SITES.IBM[1].label).toMatch(/Remote/);
    for (const city of ["Bromont", "Markham", "Ottawa", "Vancouver", "Montreal"]) expect(matchesLocationFilter({ name: "IBM" }, city)).toBe(true);
  });

  it("does not convert a negative board audit into an invented location", () => {
    expect(NO_CANADA_SWE_MATCH_AUDITS.OpenAI.source).toMatch(/^https:\/\//);
    expect(NO_CANADA_SWE_MATCH_AUDITS["Jane Street"].source).toMatch(/^https:\/\//);
    expect(matchesLocationFilter({ name: "OpenAI" }, "Canada")).toBe(false);
    expect(matchesLocationFilter({ name: "Jane Street" }, "Canada")).toBe(false);
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
        if (group.audit) expect(group.audit.source).toMatch(/^https:\/\//);
        expect(group.locations.length).toBeGreaterThan(0);
        expect(group.locations.every(site => site.city && site.country)).toBe(true);
      }
    }
  });
});
