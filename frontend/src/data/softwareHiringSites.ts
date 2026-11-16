export interface SoftwareHiringEvidence {
  locations: { city: string; country: string }[];
  source: string;
  description: string;
  checked: string;
}

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
  }],
  SOTI: [{
    locations: [{ city: "Mississauga", country: "Canada" }],
    source: "https://soti.wd3.myworkdayjobs.com/en-US/SOTI-Next-Gen/job/Software-Developer-Intern---SOTI-XSight--May-2027-12-Months-_R10611",
    description: "Software Developer Intern, SOTI XSight, May 2027",
    checked: "2026-11-16",
  }],
  Amazon: [{
    locations: ["Vancouver", "Toronto", "Victoria", "Ottawa", "Calgary"].map(city => ({ city, country: "Canada" })),
    source: "https://www.amazon.jobs/en-gb/jobs/10553947/software-development-engineer-intern-summer-2027-can",
    description: "2027 SDE internship: Canadian recruiting locations; source's Winnipeg province needs confirmation",
    checked: "2026-11-16",
  }],
  Shopify: [{
    locations: [
      ...["Montreal", "Ottawa", "Toronto"].map(city => ({ city, country: "Canada" })),
      ...["Bellevue", "New York City"].map(city => ({ city, country: "United States" })),
    ],
    source: "https://internships.shopify.com/",
    description: "Engineering and Data internships: in-person office options",
    checked: "2026-11-16",
  }],
  Databricks: [{
    locations: [
      { city: "Vancouver", country: "Canada" },
      ...["Bellevue", "Mountain View", "San Francisco"].map(city => ({ city, country: "United States" })),
    ],
    source: "https://www.databricks.com/company/careers/university-recruiting---engineering/software-engineering-intern-2027-6865687002",
    description: "Software Engineering Intern (2027)",
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
};
