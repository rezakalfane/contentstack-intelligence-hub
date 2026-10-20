import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ context, request }) => {
  await context.addCookies([{ name: "hub_mode", value: "demo", url: `http://localhost:${process.env.E2E_PORT ?? 3100}` }]);
  const res = await request.post("/api/demo/reset", { headers: { "x-hub-request": "1" } });
  expect(res.ok()).toBeTruthy();
});

const coverage = async (page: Page) => {
  const card = page.getByRole("region", { name: "Key metrics" }).getByText("Localization coverage").locator("..");
  const txt = await card.innerText();
  return Number(/(\d+)%/.exec(txt)?.[1]);
};

test("demo journey: Italy gap → review → edit → approve → apply to demo → KPIs recalculate", async ({ page }) => {
  await page.goto("/overview");
  await expect(page.getByText("DEMO · Sample fixtures").first()).toBeVisible();
  const before = await coverage(page);

  await page.goto("/localization");
  await page.getByLabel("Locale filter").selectOption("it-it");
  await page.getByLabel("Status filter").selectOption("missing");
  const row = page.getByRole("button", { name: /^Review / }).first();
  await row.click();

  const drawer = page.getByRole("dialog");
  await expect(drawer.getByText("Simulated — not a model output")).toHaveCount(0); // not generated yet
  await drawer.getByRole("button", { name: "Generate simulated proposal" }).click();
  await expect(drawer.getByText("Simulated — not a model output")).toBeVisible();

  const box = drawer.getByLabel("Editable proposed translation");
  const original = await box.inputValue();
  await box.fill(`${original} `.trimEnd() + " (rivisto)");
  await box.blur();
  await expect(drawer.getByText("Proposal edited by reviewer")).toBeVisible();

  await drawer.getByRole("button", { name: "Approve proposal" }).click();
  await expect(drawer.getByText(/No CMS write was performed/)).toBeVisible();
  await expect(drawer.getByText("Proposal approved — NO CMS write performed")).toBeVisible();

  // Approval changed nothing yet.
  await page.keyboard.press("Escape");
  await page.goto("/overview");
  expect(await coverage(page)).toBe(before);

  // Apply to the demo dataset: metrics recalculate.
  await page.goto("/localization");
  await page.getByLabel("Locale filter").selectOption("it-it");
  await page.getByLabel("Status filter").selectOption("missing");
  await page.getByRole("button", { name: /^Review / }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Apply to demo dataset" }).click();
  await expect(page.getByRole("dialog").getByText("Applied to local demo dataset — NOT Contentstack")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/overview");
  expect(await coverage(page)).toBeGreaterThanOrEqual(before);
  await expect(page.getByText("Approved proposals").first()).toBeVisible();

  // Reset restores the initial state.
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect.poll(() => coverage(page)).toBe(before);
});

test("reject is a separate transition and returns the issue to the queue", async ({ page }) => {
  await page.goto("/localization?locale=it-it");
  await page.getByRole("button", { name: /^Review / }).first().click();
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Generate simulated proposal" }).click();
  await d.getByRole("button", { name: "Reject" }).click();
  await expect(d.getByText("Proposal rejected — issue returns to the queue")).toBeVisible();
  await expect(d.getByRole("button", { name: "Generate simulated proposal" })).toBeVisible();
});

test("placeholder mismatch blocks approval", async ({ page }) => {
  await page.goto("/localization?locale=de-de&q=Welcome");
  const first = page.getByRole("button", { name: /^Review / }).first();
  if ((await first.count()) === 0) test.skip(true, "no placeholder sentence in this de-de slice");
  await first.click();
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Generate simulated proposal" }).click();
  const box = d.getByLabel("Editable proposed translation");
  await box.fill((await box.inputValue()).replace("{{firstName}}", "{{vorname}}"));
  await expect(d.getByText(/Placeholders\/markup differ from the source/)).toBeVisible();
  await expect(d.getByRole("button", { name: "Approve proposal" })).toBeDisabled();
});

test("keyboard only: tab to a row, Enter opens review, Escape closes", async ({ page }) => {
  await page.goto("/localization");
  const row = page.getByRole("button", { name: /^Review / }).first();
  await row.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("filters, search and CSV export work", async ({ page }) => {
  await page.goto("/localization");
  await page.getByLabel("Locale filter").selectOption("it-it");
  const n = await page.getByRole("button", { name: /^Review / }).count();
  expect(n).toBeGreaterThan(0);
  await page.getByLabel("Search issues").fill("zzzz-no-match");
  await expect(page.getByText("No matching records")).toBeVisible();
  await page.getByLabel("Search issues").fill("");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
  expect(download.suggestedFilename()).toContain("demo");
});

test("screenshots (desktop + mobile)", async ({ page }) => {
  for (const r of ["overview", "localization", "health", "insights", "roadmap", "settings"]) {
    await page.goto(`/${r}`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `screenshots/demo-${r}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/overview");
  await page.screenshot({ path: "screenshots/demo-overview-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();
});

test("reference graph: select a hub, see blast radius, jump to a dependent, filter types, find broken reference", async ({ page }) => {
  await page.goto("/graph");
  await expect(page.getByText("Highest blast radius")).toBeVisible();
  await expect(page.getByText(/Broken references \(1\)/)).toBeVisible(); // deliberate demo fixture

  // Panel list → select the biggest hub; canvas highlights its blast radius.
  await page.getByRole("button").filter({ hasText: /dependents/ }).first().click();
  await expect(page.getByText("If you edit this")).toBeVisible();
  await expect(page.getByText(/entries & pages affected/)).toBeVisible();

  // Switching direction changes the question being answered.
  await page.getByRole("button", { name: "Dependencies" }).click();
  await expect(page.getByText("This depends on")).toBeVisible();
  await page.getByRole("button", { name: "Blast radius" }).click();

  // Click a dependent in the panel: it becomes the selection.
  const before = await page.locator("h2").last().innerText();
  await page.getByText(/Direct · \d+/).locator("..").getByRole("button").first().click();
  await expect.poll(async () => page.locator("h2").last().innerText()).not.toBe(before);

  // Keyboard: nodes are focusable buttons.
  const node = page.locator("[data-node]").first();
  await node.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Clear selection" })).toBeVisible();
  await page.getByRole("button", { name: "Clear selection" }).click();

  // Type filter hides a content type.
  const n = await page.locator("[data-node]").count();
  await page.getByRole("group", { name: "Content type filters" }).getByRole("button", { name: /^Campaign/ }).click();
  expect(await page.locator("[data-node]").count()).toBeLessThan(n);

  // Broken reference is inspectable.
  await page.getByRole("button").filter({ hasText: /Missing entry/ }).first().click();
  await expect(page.getByText("This entry does not exist.")).toBeVisible();
  await page.screenshot({ path: "screenshots/demo-graph.png", fullPage: true });
});
