import { test, expect, type Page } from "@playwright/test";
async function signIn(page: Page) {
  await page.goto("/");
  await page
    .getByLabel("Username or email")
    .fill(process.env.PMS_SEED_ADMIN_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.PMS_SEED_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Portfolio overview" }),
  ).toBeVisible();
}
test("live dashboard, complete portfolio views, themes and operations navigation", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1050 });
  await signIn(page);
  const summary = await (await page.request.get("/api/dashboard/admin")).json();
  await expect(
    page
      .locator(".metric-card")
      .filter({ hasText: "Total Projects" })
      .locator("strong"),
  ).toHaveText(String(summary.total));
  await expect(page.locator(".metric-card")).toHaveCount(8);
  await expect(
    page.getByText("Loading workspace data...", { exact: true }),
  ).toHaveCount(0, { timeout: 30000 });
  await page.screenshot({
    path: "../.runtime/premium-dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.locator(".app-shell")).toHaveClass(/is-collapsed/);
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await page.getByRole("link", { name: "All Projects", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "Grid", exact: true }).click();
  await expect(
    page.locator(".project-grid .project-card").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Board", exact: true }).click();
  await expect(page.locator(".kanban-board .project-card")).toHaveCount(
    summary.total,
  );
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await expect(page.locator(".timeline-row")).toHaveCount(summary.total);
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await page.getByRole("button", { name: "More filters" }).click();
  await expect(page.getByLabel("Filter engineer")).toBeEnabled();
  await page.screenshot({
    path: "../.runtime/premium-projects-desktop.png",
    fullPage: true,
  });
  for (const [route, heading] of [
    ["/tasks", "Tasks"],
    ["/labour", "Labour"],
    ["/materials", "Materials"],
    ["/budgets", "Budgets"],
    ["/calendar", "Project calendar"],
    ["/reports", "Reports"],
    ["/approvals", "Approvals"],
    ["/settings", "Workspace settings"],
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Loading workspace data...", { exact: true }),
    ).toHaveCount(0, { timeout: 30000 });
  }
  expect(errors).toEqual([]);
});
test("phone layout and keyboard accessible navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await expect(
    page.getByText("Loading workspace data...", { exact: true }),
  ).toHaveCount(0, { timeout: 30000 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../.runtime/premium-dashboard-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Toggle navigation" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "All Projects", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "All projects", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../.runtime/premium-projects-mobile.png",
    fullPage: true,
  });
});
