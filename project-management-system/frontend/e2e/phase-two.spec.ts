import { test, expect } from "@playwright/test";
async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page
    .getByLabel("Username or email")
    .fill(process.env.PMS_SEED_ADMIN_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.PMS_SEED_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Portfolio overview/ })).toBeVisible();
}

test("super administrator manages a user and preserves access controls", async ({
  page,
  request,
}) => {
  await login(page);
  await page.getByRole("link", { name: "User administration", exact: true }).click();
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  const editor = page.getByRole("region", { name: "Create user", exact: true });
  await editor.getByLabel("Employee code").fill("BROWSER-001");
  await editor.getByLabel("Full name").fill("Browser Engineer");
  await editor
    .getByLabel("Email", { exact: true })
    .fill("browser-engineer@example.test");
  await editor
    .getByLabel("Initial password")
    .fill("Browser-account-password-21");
  await editor
    .getByRole("button", { name: "Create user", exact: true })
    .click();
  const row = page
    .getByRole("row")
    .filter({ hasText: "browser-engineer@example.test" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  const edit = page.getByRole("region", { name: "Edit user", exact: true });
  await edit.getByLabel("Full name").fill("Updated Browser Engineer");
  await edit.getByRole("button", { name: "Save user" }).click();
  await expect(row).toContainText("Updated Browser Engineer");
  page.on("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Suspend", exact: true }).click();
  await expect(row).toContainText("Suspended");
  const check = await request.get("/api/auth/csrf");
  const csrf = await check.json();
  const denied = await request.post("/api/auth/login", {
    headers: { [csrf.headerName]: csrf.token },
    form: {
      email: "browser-engineer@example.test",
      password: "Browser-account-password-21",
    },
  });
  expect(denied.status()).toBe(401);
  await page.reload();
  await row.getByRole("button", { name: "Reactivate", exact: true }).click();
  await expect(row).toContainText("Active");
  await page.getByRole("link", { name: "Engineers / Team", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "browser-engineer@example.test" }),
  ).toBeVisible();
});

test("project creation, exact budget, schedule history, filters and archival", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("link", { name: "All Projects", exact: true })
    .first()
    .click();
  await page.getByRole("link", { name: "Create project", exact: true }).last().click();
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Browser bridge works");
  await page.getByLabel("Category / type").fill("Bridge");
  await page.getByLabel("Location", { exact: true }).fill("Nairobi");
  await page.getByLabel("Client / department").fill("Roads department");
  await page
    .getByLabel("Planned start date", { exact: true })
    .fill("2026-11-01");
  await page.getByLabel("Planned end date", { exact: true }).fill("2026-12-01");
  await page.getByLabel("Planned budget").fill("9007199254740993.01");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Browser bridge works" }),
  ).toBeVisible();
  await expect(
    page.getByText("KES 9,007,199,254,740,993.01", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit project", exact: true }).click();
  await page.getByLabel("Planned end date", { exact: true }).fill("2026-12-05");
  await page
    .getByLabel("Schedule change reason")
    .fill("Updated client schedule");
  await page.getByLabel("Status", { exact: true }).selectOption("IN_PROGRESS");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Updated client schedule", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Back to projects", exact: true })
    .click();
  await page.getByLabel("Filter status").selectOption("IN_PROGRESS");
  await page.getByLabel("Search projects").fill("Browser bridge works");
  await page
    .getByRole("link", { name: "Browser bridge works", exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Archive project" }).click();
  await expect(page.getByText("Archived", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Back to projects", exact: true })
    .click();
  await page.getByLabel("Search projects").fill("Browser bridge works");
  await expect(
    page.getByText("No projects found", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "More filters" }).click();
  await page.getByLabel("Archived only", { exact: true }).check();
  await expect(
    page.getByRole("link", { name: "Browser bridge works", exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await page.screenshot({
    path: "../.runtime/phase-two-dashboard.png",
    fullPage: true,
  });
});
