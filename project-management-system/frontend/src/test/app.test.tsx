import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "../App";
import { api } from "../api";
vi.mock("../api", () => ({
  api: { get: vi.fn() },
  csrf: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  message: () => "Server unavailable",
}));
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());
function renderApp(path = "/") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe("protected workspace", () => {
  it("shows a loading state while establishing the session", () => {
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));
    renderApp();
    expect(screen.getByRole("status")).toHaveTextContent("Connecting");
  });
  it("shows login for an unauthenticated protected route", async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 401 } });
    renderApp("/profile");
    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
  });
  it("shows an actionable server error instead of treating it as logout", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("offline"));
    renderApp();
    expect(
      await screen.findByRole("heading", { name: "Workspace unavailable" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
});
