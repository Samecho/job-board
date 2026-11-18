import type { CompanyCatalogItem } from "../types";

export function internHiringStatus(company: Pick<CompanyCatalogItem, "intern_friendly" | "internship_evidence">) {
  if (company.intern_friendly) return "regular";
  if (company.internship_evidence) return "documented";
  return "unverified";
}
