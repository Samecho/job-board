export interface SoftwareHiringEvidence {
  locations: { city: string; country: string }[];
  source: string;
  label?: string;
  description: string;
  checked: string;
  audit?: { source: string; label: string; description: string };
}

export const NO_CANADA_SWE_MATCH_AUDITS: Record<string, { source: string; label: string; description: string }> = {
  OpenAI: {
    source: "https://api.ashbyhq.com/posting-api/job-board/openai",
    label: "Canada board audit: no direct SWE match",
    description: "2026-11-16: among 838 public Ashby postings, six had a Canadian city or province in primary or secondary location fields; none had a direct SWE title. This does not rule out other titles, unlisted roles, other boards or remote eligibility expressed elsewhere.",
  },
  "Jane Street": {
    source: "https://www.janestreet.com/join-jane-street/open-roles/?type=students-and-new-grads",
    label: "Canada board audit: no Canadian location listed",
    description: "2026-11-16: student and experienced job-board location selectors listed New York, Hong Kong, London, Singapore, Chicago and Austin, with no Canadian or remote location option. This does not rule out unlisted recruiting or Canadians applying abroad.",
  },
};

// A source establishes a recruiting location, not an exhaustive office list or a current vacancy.
export const SOFTWARE_HIRING_SITES: Record<string, SoftwareHiringEvidence[]> = {
  RBC: [{
    locations: ["Toronto", "Montreal", "Vancouver", "Halifax", "Calgary"].map(city => ({ city, country: "Canada" })),
    source: "https://jobs.rbc.com/ca/en/amplify",
    description: "Amplify summer program: developer teams and program locations",
    checked: "2026-11-16",
  }],
  Atlassian: [{
    locations: [{ city: "Vancouver", country: "Canada" }],
    source: "https://www.atlassian.com/company/careers/details/26275",
    description: "Software Engineer Intern, 2027 Canada (hybrid)",
    checked: "2026-11-16",
    audit: {
      source: "https://www.atlassian.com/company/careers/all-jobs",
      label: "2027 SWE internships audit",
      description: "2026-11-16: the public jobs list showed 14 internship postings; the two explicitly SWE-titled postings list Vancouver for Canada and Seattle or San Francisco for the US. The US job detail lists Seattle even though the result card shows San Francisco. Other titles or off-board roles are not covered.",
    },
  }, {
    locations: ["Seattle", "San Francisco"].map(city => ({ city, country: "United States" })),
    source: "https://www.atlassian.com/company/careers/details/26266",
    description: "Software Engineer Intern, 2027 Summer U.S.; hybrid and no work sponsorship",
    checked: "2026-11-16",
  }],
  SOTI: [{
    locations: [{ city: "Mississauga", country: "Canada" }],
    source: "https://soti.wd3.myworkdayjobs.com/en-US/SOTI-Next-Gen/job/Software-Developer-Intern---SOTI-XSight--May-2027-12-Months-_R10611",
    description: "Software Developer Intern, SOTI XSight, May 2027",
    checked: "2026-11-16",
  }],
  Amazon: [{
    locations: ["Vancouver", "Toronto", "Victoria", "Ottawa", "Calgary", "Winnipeg"].map(city => ({ city, country: "Canada" })),
    source: "https://www.amazon.jobs/en-gb/jobs/10553947/software-development-engineer-intern-summer-2027-can",
    label: "2027 SDE intern possible locations",
    description: "Amazon states these possible internship locations are not exhaustive and can change. The posting labels Winnipeg as MN, an apparent province abbreviation error; placement is not guaranteed.",
    checked: "2026-11-16",
    audit: {
      source: "https://www.amazon.jobs/en/search?category%5B%5D=software-development&country=CAN&loc_query=Canada",
      label: "Canada current jobs audit",
      description: "2026-11-16: reviewed all 134 Canada Software Development category jobs over 14 pages and both pages of 11 Student Programs jobs. Three intern-titled SDE jobs were in the former category; the general SDE internship was classified elsewhere. Other categories and remote eligibility were not exhaustively audited.",
    },
  }],
  Shopify: [{
    locations: [
      ...["Montreal", "Ottawa", "Toronto"].map(city => ({ city, country: "Canada" })),
      ...["Bellevue", "New York City"].map(city => ({ city, country: "United States" })),
    ],
    source: "https://internships.shopify.com/",
    description: "Engineering and Data internships: in-person office options",
    checked: "2026-11-16",
    audit: {
      source: "https://internships.shopify.com/",
      label: "Internship program locations audit",
      description: "2026-11-16: Shopify's Engineering & Data internship program explicitly lists Montreal, Ottawa, Toronto, Bellevue and New York City, with at least three in-office days per week. Its separate general SWE roles may be remote; this is not a complete map of all company SWE recruitment.",
    },
  }],
  Databricks: [{
    locations: [
      { city: "Vancouver", country: "Canada" },
      ...["Bellevue", "Mountain View", "San Francisco"].map(city => ({ city, country: "United States" })),
    ],
    source: "https://www.databricks.com/company/careers/university-recruiting---engineering/software-engineering-intern-2027-6865687002",
    description: "Software Engineering Intern (2027)",
    checked: "2026-11-16",
    audit: {
      source: "https://boards-api.greenhouse.io/v1/boards/databricks/jobs?content=true",
      label: "Canada current SWE audit",
      description: "2026-11-16: reviewed 28 Canada-matching listings out of 895 public board jobs, including office fields. Current individual-contributor SWE roles list Vancouver. Snapshot excludes unposted roles and other boards.",
    },
  }, {
    locations: [
      { city: "Aarhus", country: "Denmark" },
      { city: "Amsterdam", country: "Netherlands" },
      { city: "Belgrade", country: "Serbia" },
      { city: "Berlin", country: "Germany" },
      { city: "London", country: "United Kingdom" },
    ],
    source: "https://www.databricks.com/company/careers/open-positions",
    description: "2027 Software Engineering Intern openings on the public board; snapshot 2026-11-16, roles and locations may change",
    checked: "2026-11-16",
  }],
  AMD: [{
    locations: [{ city: "Markham", country: "Canada" }],
    source: "https://careers.amd.com/careers-home/jobs/91368",
    description: "2027 Software Engineering Intern/Co-op",
    checked: "2026-11-16",
  }],
  Qualcomm: [{
    locations: [{ city: "Markham", country: "Canada" }],
    source: "https://careers.qualcomm.com/events/candidate?plannedEventId=0AjdrYdNZ",
    description: "2026 recruiting event: Display System Software Engineering Internship",
    checked: "2026-11-16",
  }],
  Intel: [{
    locations: [{ city: "Toronto", country: "Canada" }],
    source: "https://intel.wd1.myworkdayjobs.com/External/job/Canada-Toronto/Compiler-Engineering-Intern_JR0287934",
    description: "Compiler Engineering Intern JR0287934",
    checked: "2026-11-16",
  }],
  Altera: [{
    locations: [{ city: "Toronto", country: "Canada" }],
    source: "https://altera.wd1.myworkdayjobs.com/en-US/altera/job/Toronto-Ontario-Canada/Software-Intern_R03373",
    description: "Software Intern R03373",
    checked: "2026-11-16",
  }],
  Workday: [{
    locations: [{ city: "Vancouver", country: "Canada" }],
    source: "https://workday.wd5.myworkdayjobs.com/Workday_Early_Career/job/Canada-BC-Vancouver/Software-Development-Engineer-Intern_JR-0110807",
    description: "Software Development Engineer Intern JR-0110807",
    checked: "2026-11-16",
  }],
  Google: [{
    locations: ["Waterloo", "Toronto"].map(city => ({ city, country: "Canada" })),
    source: "https://www.google.com/about/careers/applications/jobs/results/123510626377966278-software-developer-intern-bs-summer-2027",
    description: "Indexed Software Developer Intern, BS, Summer 2027; original posting may have expired",
    checked: "2026-11-16",
  }],
  Lyft: [{
    locations: [
      ...["Montreal", "Toronto"].map(city => ({ city, country: "Canada" })),
      { city: "San Francisco", country: "United States" },
      { city: "Mexico City", country: "Mexico" },
    ],
    source: "https://www.lyft.com/careers/early-talent",
    description: "2027 software engineering intern listings",
    checked: "2026-11-16",
  }],
  Uber: [{
    locations: [{ city: "Toronto", country: "Canada" }],
    source: "https://jobs.uber.com/en/jobs/?location=Toronto&radius=100",
    description: "Indexed 2027 Software Engineering Intern, Canada; listing may have expired",
    checked: "2026-11-16",
  }],
  Autodesk: [{
    locations: [{ city: "Montreal", country: "Canada" }],
    source: "https://jobs.autodesk.com/careers?domain=autodesk.com&hl=en",
    description: "Indexed Intern, Software Developer; listing may change",
    checked: "2026-11-16",
  }],
  Huawei: [{
    locations: ["Edmonton", "Kingston", "Markham", "Montreal", "Ottawa", "Vancouver", "Waterloo"].map(city => ({ city, country: "Canada" })),
    source: "https://huaweicanada.recruitee.com/all-of-our-positions",
    description: "Huawei Technologies Canada current careers board: all listed cities, each with software or software-related roles; other entities and future hiring not covered",
    checked: "2026-11-16",
  }],
  Cohere: [{
    locations: ["Toronto", "Montreal", "Ottawa"].map(city => ({ city, country: "Canada" })),
    source: "https://jobs.ashbyhq.com/cohere/39cab400-c976-41d9-9002-880ac6985b64",
    label: "Hybrid SWE job locations",
    description: "Locations listed for hybrid software roles, not a claim that every city has a Cohere office",
    checked: "2026-11-16",
    audit: {
      source: "https://api.ashbyhq.com/posting-api/job-board/cohere",
      label: "Canada software job audit",
      description: "2026-11-16: all 121 public-board postings checked by software/full-stack/frontend/backend title and primary/secondary locations; 14 of 15 matching titles listed Canada or a Canadian city. Some postings may be talent pools.",
    },
  }, {
    locations: ["Toronto", "Montreal", "Ottawa", "Vancouver", "Canada (remote)"].map(city => ({ city, country: "Canada" })),
    source: "https://jobs.ashbyhq.com/cohere/7133d205-5421-4336-a8e2-6037b5f55073",
    label: "Remote SWE job locations",
    description: "Locations listed for remote software roles; not proof of a physical office or eligibility for every Canadian resident",
    checked: "2026-11-16",
  }],
  Cisco: [{
    locations: ["Calgary", "Halifax", "Kanata", "Montreal", "Ottawa", "Saint-Laurent", "Toronto", "Vancouver"].map(city => ({ city, country: "Canada" })),
    source: "https://careers.cisco.com/global/en/job/2024208/Software-Developer-Full-Stack-Backend-I-Co-op-Canada",
    label: "Potential hybrid co-op locations",
    description: "2024208 lists these alternatives as potential opportunities. The interactive page and server-rendered page disagreed about whether applications were accepted; verify before applying. Kanata is in Ottawa and Saint-Laurent is in Montreal.",
    checked: "2026-11-16",
    audit: {
      source: "https://careers.cisco.com/global/en/search-results?keywords=software&location=Canada",
      label: "Canada current jobs audit",
      description: "2026-11-16: reviewed all 27 Canada-filtered search results across three pages and expanded the relevant location lists; nine software development roles, including potential-opportunity postings. Globally tagged remote and off-board roles may be omitted.",
    },
  }],
  Microsoft: [{
    locations: [{ city: "Vancouver", country: "Canada" }],
    source: "https://apply.careers.microsoft.com/careers/job/1970393557052867?domain=microsoft.com",
    label: "Current SWE job location",
    description: "Canada-filtered search: all ten directly software-development-titled jobs list Vancouver; nine specify one or three in-office days and one is remote. Does not establish remote eligibility across every province.",
    checked: "2026-11-16",
    audit: {
      source: "https://apply.careers.microsoft.com/careers?domain=microsoft.com&location=Canada",
      label: "Canada current jobs audit",
      description: "2026-11-16: reviewed all 60 Canada-filtered job titles across six pages, including eligible remote results, and opened all ten direct software-development matches. All display Vancouver; no SWE internship title appeared. Other titles, unlisted jobs, and remotely eligible jobs omitted by the search remain possible.",
    },
  }],
};
