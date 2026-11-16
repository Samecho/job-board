import { describe, expect, it } from "vitest";
import { COMPANY_CATALOG } from "./catalog";
import { VERIFIED_OFFICES, verifiedOfficeSearch } from "./verifiedOffices";

describe("verified office locations", () => {
  it("only associates sourced locations with existing, unambiguous companies", () => {
    for (const [name, office] of Object.entries(VERIFIED_OFFICES)) {
      expect(COMPANY_CATALOG.filter(company => company.name === name)).toHaveLength(1);
      expect(office.locations).toContain("Canada:");
      expect(new URL(office.source).protocol).toBe("https:");
      if (office.additionalSource) expect(new URL(office.additionalSource).protocol).toBe("https:");
      expect(office.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("keeps unresearched companies unknown and makes verified cities searchable", () => {
    expect(verifiedOfficeSearch("Unknown company")).toBe("");
    expect(verifiedOfficeSearch("AMD")).toContain("Ottawa");
  });
});
