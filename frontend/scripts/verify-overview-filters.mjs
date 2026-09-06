import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  await page.goto(process.env.TEST_URL || "http://127.0.0.1:4173/");
  const filters = page.locator(".simple-filters select");
  await filters.first().waitFor();
  await page.getByPlaceholder("Search companies, categories, locations...").fill("Google");
  await filters.nth(0).selectOption("S");
  await filters.nth(1).selectOption("Not Applied");
  await filters.nth(2).selectOption({ index: 1 });
  await filters.nth(3).selectOption("yes");
  await page.locator(".overview-table th button").nth(1).click();
  await page.locator(".overview-table th button").nth(1).click();
  const sortLabel = await page.locator(".overview-table th button").nth(1).innerText();
  const expected = await filters.evaluateAll(elements => elements.map(element => element.value));
  await page.getByRole("button", { name: "Cards", exact: true }).click();
  for (const tab of ["Analytics", "Resume"]) {
    await page.locator("nav").getByRole("button", { name: tab, exact: true }).click();
    await page.locator("nav").getByRole("button", { name: "Overview", exact: true }).click();
    if (await page.getByPlaceholder("Search companies, categories, locations...").inputValue() !== "Google") throw new Error("Search reset");
    const actual = await filters.evaluateAll(elements => elements.map(element => element.value));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Filters reset");
    if (!await page.getByRole("button", { name: "Cards", exact: true }).evaluate(button => button.classList.contains("active"))) throw new Error("View reset");
  }
  await page.getByRole("button", { name: "Table", exact: true }).click();
  if (await page.locator(".overview-table th button").nth(1).innerText() !== sortLabel) throw new Error("Sort reset");
  console.log("Overview search, all filters, view, and descending sort survive both tab round trips.");
} finally {
  await browser.close();
}
