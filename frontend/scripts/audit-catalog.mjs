import fs from "node:fs";

const catalogPath = new URL("../src/data/catalog.ts", import.meta.url);
const source = fs.readFileSync(catalogPath, "utf8");
const start = source.indexOf("= [");
const catalog = JSON.parse(source.slice(start + 2, source.lastIndexOf("]") + 1));

// September 2026 resume-signal audit. Internship availability is tracked separately and does not affect tier.
const tierOverrides = {
  "Millennium": "A",
  "Point72": "A",
  "AQR Capital Management": "A",
  "Mistral AI": "A+",
  "Moonshot AI": "S",
  "Supabase": "A+",
  "Neon": "A+",
  "Weights & Biases": "A+",
  "Perplexity": "A+",
  "Cohere": "A+",
  "Scale AI": "A",
  "Character.AI": "A",
  "Microsoft": "S",
  "SpaceX": "S",
  "Tesla": "A+",
  "Broadcom": "A+",
  "ASML": "A",
  "TSMC": "A",
  "Qualcomm": "A",
  "Marvell": "A",
  "Oracle": "A",
  "IBM": "B+",
  "VMware": "B+",
  "Rippling": "A",
  "Discord": "A",
  "Reddit": "A+",
  "Affirm": "B+",
  "Chime": "B+",
  "Wise": "B+",
  "PayPal": "B+",
  "Salesforce": "B+",
  "ServiceNow": "A",
  "Shopify": "A",
  "Palo Alto Networks": "A+",
  "CrowdStrike": "A+",
  "Fortinet": "A",
  "Nokia": "B+",
  "Valve": "A",
  "Tencent": "A",
  "HoYoverse": "B+",
  "Anduril": "S",
  "Shield AI": "A+",
  "Intuitive Surgical": "A",
  "Rocket Lab": "A",
  "Blue Origin": "A",
  "MDA Space": "A",
  "Safran": "C",
  "Autodesk": "A",
  "Esri": "A",
  "Philips": "C",
  "Mojang Studios": "B",
  "Audible": "B",
  "Pulumi": "B+",
  "PlanetScale": "B+",
  "Redis": "B+",
  "Weaviate": "B+",
  "Postman": "B+",
  "JetBrains": "B+",
  "Honeycomb": "B+",
  "Chronosphere": "B+",
  "Twilio": "B",
  "Zoom": "B",
  "dbt Labs": "B+",
  "Dagster Labs": "B+",
  "Fastly": "B+",
  "SambaNova Systems": "A",
  "Tenstorrent": "A+",
  "Graphcore": "B+",
  "Astera Labs": "A",
  "Astranis": "A",
  "Axiom Space": "B",
  "Varda Space Industries": "A",
  "Stoke Space": "A",
  "Firefly Aerospace": "B+",
  "Sierra Space": "B",
  "The Aerospace Corporation": "B",
  "MITRE": "B",
  "Kratos Defense": "B",
  "Lucid Motors": "B",
  "Procore": "B+",
  "Bentley Systems": "B+",
  "Ansys": "A",
  "Cadence Design Systems": "A+",
  "Synopsys": "A+",
  "Keysight Technologies": "B",
  "NI": "B",
  "Epic Systems": "B+",
  "Flatiron Health": "B",
  "Veeva Systems": "B",
  "Thermo Fisher Scientific": "C",
  "Moderna": "C",
  "Akuna Capital": "A",
  "Virtu Financial": "A",
  "Superhuman": "B+",
  "Miro": "B+",
  "Abridge": "A+",
  "Poolside": "A",
  "Magic": "A",
  "Lambda": "A+",
  "Crusoe": "A+",
  "Modal": "A+",
  "Ideogram": "A+",
  "Pika": "B+",
  "Synthesia": "B+",
  "Baseten": "A+",
  "Clerk": "B+",
  "Convex": "A",
  "Turso": "B+",
  "Alibaba": "A+",
  "Kuaishou": "B+",
  "MiniMax": "A+",
  "Z.ai": "A+",
  "01.AI": "B+",

  "SenseTime": "B",
  "NASA": "B+"
};

// These are one application target as of September 2026. IDs are never reused.
const consolidatedIds = new Set([25, 118, 195, 294, 307, 330, 335, 512]);

const additions = [
  [507, "Intuit", "intuit.com", "A", "Enterprise Software", "Mountain View, San Diego, New York, Atlanta, Toronto", true, "https://www.intuit.com/careers/programs/internships/"],
  [508, "World Labs", "worldlabs.ai", "A+", "AI & ML", "San Francisco", false, "https://www.worldlabs.ai/careers"],
  [509, "Physical Intelligence", "pi.website", "A+", "Robotics & Mobility", "San Francisco", false, "https://www.pi.website/join-us"],
  [510, "Reflection AI", "reflection.ai", "A+", "AI & ML", "New York, San Francisco", false, "https://reflection.ai/careers"],
  [511, "Periodic Labs", "periodic.ai", "A", "AI & ML", "San Francisco", false, "https://periodic.ai/careers"],

  [513, "Saronic", "saronic.com", "A+", "Aerospace & Defense", "Austin, Washington, D.C.", false, "https://www.saronic.com/careers"],
  [514, "Skild AI", "skild.ai", "A+", "Robotics & Mobility", "Pittsburgh, San Francisco", false, "https://www.skild.ai/careers"],
  [515, "Hadrian", "hadrian.co", "A", "Aerospace & Defense", "Los Angeles", false, "https://www.hadrian.co/careers"],
  [516, "Apptronik", "apptronik.com", "A", "Robotics & Mobility", "Austin", false, "https://apptronik.com/careers"],
  [517, "Radix Trading", "radixtrading.com", "A+", "Finance & Trading", "Chicago, New York, Amsterdam", true, "https://www.radixtrading.com/careers"],
  [518, "Aquatic Capital Management", "aquatic.com", "A+", "Finance & Trading", "Chicago, New York", true, "https://www.aquatic.com/careers"],
  [519, "XTX Markets", "xtxmarkets.com", "A+", "Finance & Trading", "New York, London", true, "https://www.xtxmarkets.com/careers/"],
  [520, "PDT Partners", "pdtpartners.com", "A+", "Finance & Trading", "New York", false, "https://pdtpartners.com/careers/"],
  [521, "Renaissance Technologies", "rentec.com", "A", "Finance & Trading", "New York", false, "https://www.rentec.com/Careers.action"],
  [522, "Chicago Trading Company", "chicagotrading.com", "A", "Finance & Trading", "Chicago, New York", true, "https://www.chicagotrading.com/careers/"],
  [523, "Old Mission", "oldmissioncapital.com", "A", "Finance & Trading", "Chicago, New York", true, "https://www.oldmissioncapital.com/careers/"],
  [524, "Flow Traders", "flowtraders.com", "A", "Finance & Trading", "New York, Chicago, Amsterdam", true, "https://www.flowtraders.com/careers/"],
  [525, "Chainguard", "chainguard.dev", "A", "Security & Networking", "United States, Remote", false, "https://www.chainguard.dev/careers"],
  [526, "Abnormal Security", "abnormal.ai", "A", "Security & Networking", "United States, Canada, Remote", false, "https://abnormal.ai/careers"],
  [527, "Cyera", "cyera.com", "A", "Security & Networking", "New York, Tel Aviv", false, "https://www.cyera.com/careers"],
  [528, "Island", "island.io", "A", "Security & Networking", "Dallas, New York, Tel Aviv", false, "https://www.island.io/careers"],
  [529, "Etched", "etched.com", "A+", "Hardware & Semiconductors", "San Jose", false, "https://www.etched.com/careers"],
  [530, "Lightmatter", "lightmatter.co", "A", "Hardware & Semiconductors", "Mountain View, Boston, Toronto", false, "https://lightmatter.co/careers/"],
  [531, "Mercury", "mercury.com", "A", "Finance & Trading", "United States, Remote", false, "https://mercury.com/jobs"],
  [532, "Carta", "carta.com", "B+", "Finance & Trading", "San Francisco, New York, Waterloo", false, "https://carta.com/careers/"],
  [533, "ServiceTitan", "servicetitan.com", "B+", "Enterprise Software", "Glendale, Atlanta", true, "https://www.servicetitan.com/careers"],
  [534, "Yelp", "yelp.com", "B+", "Big Tech & Consumer", "United States, Canada, Remote", true, "https://www.yelp.careers/us/en"],
  [535, "SoFi", "sofi.com", "B+", "Finance & Trading", "San Francisco, Seattle, New York", true, "https://www.sofi.com/careers/"],
  [536, "Agility Robotics", "agilityrobotics.com", "A", "Robotics & Mobility", "Salem, Pittsburgh", false, "https://www.agilityrobotics.com/about/careers"],
  [537, "Field AI", "fieldai.com", "A", "Robotics & Mobility", "Irvine, San Francisco", false, "https://www.fieldai.com/careers"],
  [538, "Saildrone", "saildrone.com", "A", "Robotics & Mobility", "Alameda, Washington, D.C.", false, "https://www.saildrone.com/careers"],
  [539, "Vannevar Labs", "vannevarlabs.com", "A", "Aerospace & Defense", "United States, Remote", false, "https://www.vannevarlabs.com/careers"],
  [540, "Hermeus", "hermeus.com", "A", "Aerospace & Defense", "Atlanta, Washington, D.C.", false, "https://www.hermeus.com/careers"],
  [541, "Luma AI", "lumalabs.ai", "A", "AI & ML", "Palo Alto", false, "https://lumalabs.ai/careers"],
  [542, "Higgsfield", "higgsfield.ai", "A", "AI & ML", "San Francisco", false, "https://higgsfield.ai/careers"],
  [543, "Wispr Flow", "wisprflow.ai", "A", "AI & ML", "San Francisco", false, "https://wisprflow.ai/careers"],
  [544, "Black Forest Labs", "blackforestlabs.ai", "A", "AI & ML", "San Francisco, Freiburg", false, "https://blackforestlabs.ai/careers"],
  [545, "Decart", "decart.ai", "A", "AI & ML", "San Francisco, Tel Aviv", false, "https://www.decart.ai/careers"],
  [546, "Kalshi", "kalshi.com", "A", "Finance & Trading", "New York", false, "https://kalshi.com/careers"],
  [547, "DeepSeek", "deepseek.com", "S", "AI & ML", "Hangzhou, China, Global", false, "https://deepseek.com/"],
  [548, "Nebius", "nebius.com", "A+", "Cloud & Infrastructure", "United States, Europe, Israel, Remote", false, "https://careers.nebius.com/"],
  [549, "Nscale", "nscale.com", "A+", "Cloud & Infrastructure", "London, San Francisco, North America, Europe", false, "https://www.nscale.com/open-positions"],
  [550, "Runpod", "runpod.io", "A", "Cloud & Infrastructure", "United States, Canada, Europe, Remote", false, "https://www.runpod.io/careers"],
  [551, "Generalist AI", "generalistai.com", "A+", "Robotics & Mobility", "United States", false, "https://generalistai.com/"],
  [552, "Fluidstack", "fluidstack.io", "A", "Cloud & Infrastructure", "New York, San Francisco, Austin, Seattle", false, "https://www.fluidstack.io/"],
  [553, "Voleon", "voleon.com", "A", "Finance & Trading", "Berkeley, New York, Remote", false, "https://voleon.com/jobs/"],
  [554, "Quadrature Capital", "quadrature.ai", "A", "Finance & Trading", "London, New York, Singapore", true, "https://job-boards.greenhouse.io/quadraturecapital"],
  [555, "WorldQuant", "worldquant.com", "A", "Finance & Trading", "New York, London, Singapore, Global", true, "https://www.worldquant.com/careers/"]
].map(([id, name, domain, tier, category, main_locations, intern_friendly, career_url]) => ({
  id,
  name,
  display_name: name,
  domain,
  logo_url: `https://www.google.com/s2/favicons?domain_url=https://${domain}&sz=128`,
  career_url,
  tier,
  category,
  main_locations,
  intern_friendly,
  link: career_url
}));

const allowedTiers = new Set(["S+", "S", "A+", "A", "B+", "B", "C", "D"]);
const updated = catalog
  .filter(company => !consolidatedIds.has(company.id))
  .map(company => ({ ...company, tier: tierOverrides[company.name] || company.tier }));

for (const addition of additions) {
  if (!consolidatedIds.has(addition.id) && !updated.some(company => company.id === addition.id || company.name === addition.name || company.domain === addition.domain)) updated.push(addition);
}

const ids = new Set();
const names = new Set();
for (const company of updated) {
  if (!allowedTiers.has(company.tier)) throw new Error(`Invalid tier for ${company.name}: ${company.tier}`);
  if (ids.has(company.id)) throw new Error(`Duplicate ID: ${company.id}`);
  if (names.has(company.name.toLowerCase())) throw new Error(`Duplicate name: ${company.name}`);
  ids.add(company.id);
  names.add(company.name.toLowerCase());
}

const output = `import type { CompanyCatalogItem } from "../types";\n\nexport const COMPANY_CATALOG: CompanyCatalogItem[] = ${JSON.stringify(updated, null, 2)};\n`;
fs.writeFileSync(catalogPath, output);

const counts = Object.fromEntries([...allowedTiers].map(tier => [tier, updated.filter(company => company.tier === tier).length]));
console.log(JSON.stringify({ before: catalog.length, after: updated.length, consolidated: consolidatedIds.size, additions: additions.length, counts }, null, 2));
