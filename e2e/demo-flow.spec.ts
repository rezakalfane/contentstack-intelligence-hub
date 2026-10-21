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

test("SEO audit: filter by rule, simulated suggestion, edit, approve, apply to demo, score recalculates", async ({ page }) => {
  await page.goto("/seo?rule=SEO-001");
  await expect(page.getByRole("heading", { name: "Be found. Be quoted." })).toBeVisible();
  const kpi = async (label: string) => {
    const txt = await page.getByRole("region", { name: "Scores" }).getByText(label).locator("..").innerText();
    return Number(/(\d+)/.exec(txt.replace(label, ""))?.[1]);
  };
  const openBefore = await kpi("Open findings");

  // The rule filter from the URL preselects only missing-meta-description findings.
  await page.getByLabel("Status filter").selectOption("open");
  await page.getByRole("button", { name: /^Review SEO-001/ }).first().click();
  const d = page.getByRole("dialog");
  await expect(d.getByText("Meta description is empty")).toBeVisible();
  await expect(d.getByText(/0 characters · target/)).toBeVisible();

  await d.getByRole("button", { name: "Generate simulated suggestion" }).click();
  await expect(d.getByText("Simulated — not a model output")).toBeVisible();
  const box = d.getByLabel("Editable suggestion");
  expect((await box.inputValue()).length).toBeGreaterThan(40);
  await expect(d.getByText(/characters · target .*✓/)).toBeVisible(); // within range

  await box.fill((await box.inputValue()) + " Reviewed by a human.");
  await box.blur();
  await expect(d.getByText("Proposal edited by reviewer")).toBeVisible();
  await d.getByRole("button", { name: "Approve suggestion" }).click();
  await expect(d.getByText(/No Contentstack write was performed/)).toBeVisible();
  await d.getByRole("button", { name: "Apply to demo dataset" }).click();
  await expect(d.getByText("Applied to local demo dataset — NOT Contentstack")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/seo");
  expect(await kpi("Open findings")).toBeLessThan(openBefore);
  await page.screenshot({ path: "screenshots/demo-seo.png", fullPage: true });
});

test("SEO audit: non-text findings explain the fix and offer no AI suggestion", async ({ page }) => {
  await page.goto("/seo?rule=SEO-008");
  await page.getByRole("button", { name: /^Review SEO-008/ }).first().click();
  const d = page.getByRole("dialog");
  await expect(d.getByText(/How to fix/)).toBeVisible();
  await expect(d.getByText(/needs an editorial or schema change/)).toBeVisible();
  await expect(d.getByRole("button", { name: /Generate/ })).toHaveCount(0);
});

test("schema governance: overview, overlap heatmap, rule filter, type structure drawer", async ({ page }) => {
  await page.goto("/schema");
  await expect(page.getByRole("heading", { name: "Keep the model simple enough to change." })).toBeVisible();
  await expect(page.getByText("Governance score")).toBeVisible();
  await page.screenshot({ path: "screenshots/demo-schema.png", fullPage: true }); // clean page, before any drawer opens

  // Overlap heatmap: click a cell, see which fields are shared.
  await page.getByRole("button", { name: /Campaign and Landing page share \d+ fields/ }).click();
  await expect(page.getByRole("status").filter({ hasText: /overlap|Click a cell/ })).toContainText(/Campaign ↔ Landing page/);

  // Rule filter: rule counts are clickable and filter the recommendations.
  await page.getByLabel("Rule filter").selectOption("SCH-003");
  await expect(page.getByText(/Nested \d+ levels deep/)).toBeVisible();
  await page.getByText(/Nested \d+ levels deep/).click();
  await expect(page.getByText(/Recommendation:/).first()).toBeVisible();

  // Type drawer: structure tree with usage bars and the change-risk box.
  await page.getByRole("button", { name: "Open Landing page structure", exact: true }).click();
  const d = page.getByRole("dialog");
  await expect(d.getByText("If you make a breaking change here")).toBeVisible();
  await expect(d.getByText("field1", { exact: true }).first()).toBeVisible();
  await expect(d.getByText("0%").first()).toBeVisible(); // an unused field is visible as 0%
  await page.screenshot({ path: "screenshots/demo-schema-drawer.png" }); // viewport only: the drawer is position:fixed
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
