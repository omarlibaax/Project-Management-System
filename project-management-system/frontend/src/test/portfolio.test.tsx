import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ProjectExplorer from "../pages/ProjectExplorer";
import { subtractMoney, sumMoney } from "../lib/portfolio";
import { money } from "../components/shared";
import { api } from "../api";
import type { Project } from "../types";
vi.mock("../api", () => ({
  api: { get: vi.fn() },
  message: () => "Unable to load projects",
}));
const user = {
  id: 1,
  employeeCode: "A1",
  fullName: "Manager",
  email: "manager@example.test",
  roles: ["ADMIN"],
};
const fixture = (id: number): Project => ({
  id,
  code: `P-${id}`,
  name: `Project ${id}`,
  description: "Construction work",
  location: "Nairobi",
  category: "Construction",
  client: "Client",
  managerId: 1,
  managerName: "Manager",
  plannedStartDate: "2026-01-01",
  plannedEndDate: "2026-12-31",
  originalStartDate: "2026-01-01",
  originalEndDate: "2026-12-31",
  actualStartDate: null,
  actualEndDate: null,
  revisedEndDate: null,
  plannedDuration: 365,
  priority: "HIGH",
  status: "IN_PROGRESS",
  scheduleCondition: "ON_SCHEDULE",
  plannedBudget: "1000.00",
  approvedBudget: "900.00",
  actualExpenditure: "125.50",
  progress: 25,
  archived: false,
  createdBy: "Manager",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  version: 0,
});
function show() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <ProjectExplorer user={user} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
describe("portfolio experience", () => {
  it("keeps remaining budgets exact beyond JavaScript safe integer precision", () => {
    expect(subtractMoney("9007199254740993.01", "0.02")).toBe(
      "9007199254740992.99",
    );
    expect(sumMoney(["9007199254740993.01", "0.02"])).toBe(
      "9007199254740993.03",
    );
    expect(money(subtractMoney("0.01", "0.50"))).toBe("KES -0.49");
  });
  it("loads every API page and shows all matches in board and timeline views", async () => {
    vi.mocked(api.get).mockImplementation(async (url, config) => {
      if (url === "/workspace") return { data: { currency: "KES" } };
      if (url.endsWith("/execution"))
        return {
          data: {
            assignments: [],
            tasks: [],
            resources: [],
            requests: [],
            evidence: [],
          },
        };
      const page = (config?.params as { page?: number } | undefined)?.page ?? 0;
      return {
        data: {
          items:
            page === 0
              ? Array.from({ length: 100 }, (_, i) => fixture(i + 1))
              : [fixture(101)],
          totalPages: 2,
        },
      };
    });
    show();
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Project 1" }),
      ).toBeVisible(),
    );
    expect(
      screen.queryByRole("link", { name: "Project 101" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Board" }),
    );
    expect(
      await screen.findByRole("link", { name: "Project 101" }),
    ).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "Timeline" }),
    );
    expect(
      screen.getByRole("link", { name: "Project 101, 25% complete" }),
    ).toBeVisible();
  });
  it("filters on real assignment records and reports exact approved remaining funds", async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === "/workspace") return { data: { currency: "KES" } };
      if (url.endsWith("/execution"))
        return {
          data: {
            assignments: url.includes("/1/")
              ? [
                  {
                    id: 1,
                    engineer_id: 22,
                    full_name: "Amina Hassan",
                    revoked_at: null,
                  },
                ]
              : [],
            tasks: [],
            resources: [],
            requests: [],
            evidence: [],
          },
        };
      return { data: { items: [fixture(1), fixture(2)], totalPages: 1 } };
    });
    show();
    await screen.findByRole("link", { name: "Project 1" });
    await userEvent.click(screen.getByRole("button", { name: "More filters" }));
    await screen.findByRole("option", { name: "Amina Hassan" });
    await userEvent.selectOptions(
      screen.getByLabelText("Filter engineer"),
      "22",
    );
    expect(
      screen.getByRole("link", { name: "Project 1" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Project 2" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("KES 774.50", { exact: true })).toBeVisible();
  });
});
