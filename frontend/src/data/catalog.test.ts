import { describe, expect, it } from "vitest";
import { COMPANY_CATALOG } from "./catalog";
import { internHiringStatus } from "../lib/internHiring";

describe("company catalog integrity", () => {
  it("keeps company IDs and names unique", () => {
    for (const values of [
      COMPANY_CATALOG.map(company => String(company.id)),
      COMPANY_CATALOG.map(company => company.name.toLowerCase()),
    ]) {
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("does not add duplicate domains", () => {
    const added = COMPANY_CATALOG.filter(company => company.id >= 10001);
    for (const company of added) {
      expect(COMPANY_CATALOG.filter(item => item.domain.toLowerCase() === company.domain.toLowerCase())).toHaveLength(1);
    }
  });

  it("retains existing company IDs and appends the new companies", () => {
    const ids = new Map(COMPANY_CATALOG.map(company => [company.name, company.id]));
    expect(ids.get("Amazon")).toBe(52);
    expect(ids.get("Ericsson")).toBe(168);
    expect(ids.get("Workday")).toBe(124);
    expect(ids.get("Altera")).toBe(10001);
    expect(ids.get("Genetec")).toBe(10002);
    expect(ids.get("Everpure")).toBe(338);
    expect(COMPANY_CATALOG.find(company => company.id === 338)?.aliases).toContain("Pure Storage");
  });

  it("keeps technical tier anchors separate from internship hiring", () => {
    const byName = new Map(COMPANY_CATALOG.map(company => [company.name, company]));
    for (const name of ["Amazon", "Apple", "Microsoft"]) expect(byName.get(name)?.tier).toBe("S");
    for (const name of ["Shopify", "Qualcomm", "AMD"]) expect(byName.get(name)?.tier).toBe("A+");
    expect(internHiringStatus(byName.get("Red Hat")!)).toBe("regular");
    expect(internHiringStatus(byName.get("Cohere")!)).toBe("documented");
    expect(internHiringStatus(byName.get("SSI")!)).toBe("unverified");
    for (const company of COMPANY_CATALOG) {
      if (company.internship_evidence) expect(company.internship_evidence).toMatch(/^https:\/\//);
    }
  });

  it("uses secure matching career and default links for added companies", () => {
    for (const company of COMPANY_CATALOG.filter(item => item.id >= 10001)) {
      expect(company.career_url).toMatch(/^https:\/\//);
      expect(company.link).toBe(company.career_url);
    }
  });
});
