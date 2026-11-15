import { describe, expect, it } from "vitest";
import { COMPANY_CATALOG } from "./catalog";

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
  });

  it("uses secure matching career and default links for added companies", () => {
    for (const company of COMPANY_CATALOG.filter(item => item.id >= 10001)) {
      expect(company.career_url).toMatch(/^https:\/\//);
      expect(company.link).toBe(company.career_url);
    }
  });
});
