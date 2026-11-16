// Verified offices are partial, not a list of all hiring locations.
export interface VerifiedOffices {
  locations: string;
  source: string;
  checked: string;
}

export const VERIFIED_OFFICES: Record<string, VerifiedOffices> = {
  "AMD": { locations: "Canada: Calgary, Markham, Ottawa, Vancouver, Waterloo", source: "https://www.amd.com/en/corporate/locations.html", checked: "2026-11-16" },
  "Autodesk": { locations: "Canada: Montreal, Toronto", source: "https://www.autodesk.com/company/contact-us/office-locations/americas", checked: "2026-11-16" },
  "Cisco": { locations: "Canada: Vancouver, Kanata (Ottawa), Toronto, Saint-Laurent (Montreal)", source: "https://www.cisco.com/site/us/en/about/contact-cisco/global-office-locations.html", checked: "2026-11-16" },
  "Clio": { locations: "Canada: Burnaby, Toronto, Calgary", source: "https://www.clio.com/en-ca/contact/", checked: "2026-11-16" },
  "Databricks": { locations: "Canada: Toronto, Vancouver", source: "https://www.databricks.com/company/contact/office-locations", checked: "2026-11-16" },
  "Google": { locations: "Canada: Kitchener, Montreal, Toronto", source: "https://about.google/company-info/locations/", checked: "2026-11-16" },
  "IBM": { locations: "Canada: Markham, Bedford, Montreal, Quebec City, Toronto, Calgary, Vancouver", source: "https://www.sap.com/partners/profile/international-business-machines-ibm", checked: "2026-11-16" },
  "Lyft": { locations: "Canada: Montreal, Longueuil, Toronto", source: "https://www.lyft.com/careers/life-at-lyft", checked: "2026-11-16" },
  "Microsoft": { locations: "Canada: Vancouver", source: "https://careers.microsoft.com/v2/global/en/locations/vancouver.html", checked: "2026-11-16" },
  "NVIDIA": { locations: "Canada: Toronto", source: "https://www.nvidia.com/en-gb/contact/?section=locations", checked: "2026-11-16" },
  "Qualcomm": { locations: "Canada: Toronto, Vancouver", source: "https://www.qualcomm.com/company/facilities/offices", checked: "2026-11-16" },
  "SAP": { locations: "Canada: Calgary, Montreal, Ottawa, Toronto, Vancouver, Waterloo", source: "https://www.sap.com/romania/about/company/office-locations/canada.html", checked: "2026-11-16" },
  "SOTI": { locations: "Canada: Mississauga", source: "https://soti.net/about/contact-us/", checked: "2026-11-16" },
  "Tenstorrent": { locations: "Canada: Toronto", source: "https://tenstorrent.com/en/careers/software", checked: "2026-11-16" },
  "Ubisoft": { locations: "Canada: Montreal, Chicoutimi, Toronto, Quebec City, Sherbrooke", source: "https://www.ubisoft.com/en-us/company/careers/locations", checked: "2026-11-16" },
};

export function verifiedOfficeSearch(name: string): string {
  return VERIFIED_OFFICES[name]?.locations ?? "";
}
