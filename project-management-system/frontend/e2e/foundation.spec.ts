import { test, expect } from "@playwright/test";
async function signIn(page: import("@playwright/test").Page, engineer = false) {
  await page.goto("/");
  await page
    .getByLabel("Email address")
    .fill(
      process.env[
        engineer ? "PMS_SEED_ENGINEER_EMAIL" : "PMS_SEED_ADMIN_EMAIL"
      ]!,
    );
  await page
    .getByLabel("Password", { exact: true })
    .fill(
      process.env[
        engineer ? "PMS_SEED_ENGINEER_PASSWORD" : "PMS_SEED_ADMIN_PASSWORD"
      ]!,
    );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Welcome,/ })).toBeVisible();
}
test("administrator login, real settings, session cookie, profile and logout", async ({
  page,
  context,
}) => {
  await signIn(page);
  await expect(page.getByText("Total projects", { exact: true })).toBeVisible();
  expect(
    (await (await page.request.get("/api/workspace")).json()).timezone,
  ).toBe("Africa/Nairobi");
  const cookie = (await context.cookies()).find((c) => c.name === "JSESSIONID");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect((await page.request.get("/api/admin/access-check")).status()).toBe(
    200,
  );
  expect((await page.request.post("/api/auth/logout")).status()).toBe(403);
  await page.screenshot({
    path: "../.runtime/workspace-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "My profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Change password" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});
test("engineer role restriction and mobile navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, true);
  expect((await page.request.get("/api/admin/access-check")).status()).toBe(
    403,
  );
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "My profile" }).click();
  await expect(page.getByLabel("Current password")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../.runtime/profile-mobile.png",
    fullPage: true,
  });
});
