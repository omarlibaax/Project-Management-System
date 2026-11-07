import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  projectSchema,
  ProjectsPage,
  ProjectFormPage,
} from "../pages/Projects";
import { createUserSchema } from "../pages/Users";
import { money } from "../components/shared";
import { api } from "../api";
vi.mock("../api", () => ({
  api: { get: vi.fn(), post: vi.fn() },
  csrf: vi.fn(),
  message: () => "Unable to load projects",
}));
const profile = {
  id: 1,
  employeeCode: "M-1",
  fullName: "Manager",
  email: "manager@example.test",
  roles: ["SUPER_ADMIN"],
};
const valid = {
  name: "Foundation",
  description: "",
  category: "Construction",
  location: "Nairobi",
  client: "Client",
  managerId: "1",
  plannedStartDate: "2026-11-01",
  plannedEndDate: "2026-12-01",
  priority: "HIGH",
  status: "PLANNED",
  plannedBudget: "9007199254740993.01",
  scheduleChangeReason: "",
};
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());
function show(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}
describe("project forms and list", () => {
  it("rejects reversed dates and negative or overprecise budgets", () => {
    expect(
      projectSchema.safeParse({ ...valid, plannedEndDate: "2026-10-01" })
        .success,
    ).toBe(false);
    expect(
      projectSchema.safeParse({ ...valid, plannedBudget: "-1" }).success,
    ).toBe(false);
    expect(
      projectSchema.safeParse({ ...valid, plannedBudget: "10.001" }).success,
    ).toBe(false);
    expect(projectSchema.safeParse(valid).success).toBe(true);
  });
  it("preserves exact decimal digits when displaying large financial values", () => {
    expect(money("9007199254740993.01", "KES")).toBe(
      "KES 9,007,199,254,740,993.01",
    );
  });
  it("validates required project fields without submitting", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { items: [{ id: 1, fullName: "Manager" }], currency: "KES" },
    });
    show(<ProjectFormPage user={profile} />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Create project" }),
    );
    expect(await screen.findByText("Enter a project name")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
  it("sends status filter to the backend", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { items: [], total: 0, page: 0, size: 20, totalPages: 0 },
    });
    show(<ProjectsPage user={profile} />);
    await userEvent.selectOptions(
      screen.getByLabelText("Filter status"),
      "ON_HOLD",
    );
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith(
        "/projects",
        expect.objectContaining({
          params: expect.objectContaining({ status: "ON_HOLD", page: 0 }),
        }),
      ),
    );
  });
  it("shows query errors with retry", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("offline"));
    show(<ProjectsPage user={profile} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load projects",
    );
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
  it("does not expose the create-project form to engineers", () => {
    show(<ProjectFormPage user={{ ...profile, roles: ["ENGINEER"] }} />);
    expect(screen.getByText("Management access required")).toBeInTheDocument();
    expect(screen.queryByLabelText("Project name")).not.toBeInTheDocument();
  });
  it("requires strong initial user password and a role", () => {
    const user = {
      fullName: "Engineer",
      phone: "",
      position: "",
      departmentId: "",
      roles: [],
      employeeCode: "E1",
      email: "engineer@example.test",
      password: "short",
    };
    expect(createUserSchema.safeParse(user).success).toBe(false);
  });
});
