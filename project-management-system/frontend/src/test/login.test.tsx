import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Login, loginSchema } from "../App";
afterEach(cleanup);
describe("login", () => {
  it("rejects invalid credentials", () => {
    expect(
      loginSchema.safeParse({ email: "invalid", password: "" }).success,
    ).toBe(false);
  });
  it("validates required password before calling the backend", async () => {
    const onLogin = vi.fn();
    render(<Login onLogin={onLogin} />);
    await userEvent.type(
      screen.getByLabelText("Email address"),
      "engineer@example.test",
    );
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter your password")).toBeInTheDocument();
    expect(onLogin).not.toHaveBeenCalled();
  });
});
