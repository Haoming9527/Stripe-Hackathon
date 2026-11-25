// @vitest-environment jsdom
import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ErrorPage from "../app/error";
import Loading from "../app/loading";
import NotFound from "../app/not-found";
import { SignOutButton } from "../app/login/login-buttons";
import { JoinForm } from "../app/join/[eventId]/[token]/JoinForm";
import Privacy from "../app/privacy/page";
import Terms from "../app/terms/page";

const f = vi.hoisted(() => ({ pathname: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: f.pathname,
}));
vi.mock("next-auth/react", () => ({ signOut: f.signOut }));
afterEach(cleanup);

it("offers an accessible loading indicator, recovery action, and gallery link for missing pages", () => {
  const reset = vi.fn();
  const view = render(<Loading />);
  expect(screen.getByRole("status", { name: "Loading" }).textContent).toContain("Loading page");
  view.rerender(<ErrorPage error={new Error("unavailable")} reset={reset} />);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(reset).toHaveBeenCalledOnce();
  view.rerender(<NotFound />);
  expect(screen.getByRole("link", { name: "Explore hackathons" }).getAttribute("href")).toBe("/hackathons");
});

it("shows sign-out on the login page and sends the account back there", async () => {
  f.pathname.mockReturnValue("/");
  const view = render(<SignOutButton />);
  expect(screen.queryByRole("button")).toBeNull();
  f.pathname.mockReturnValue("/login");
  view.rerender(<SignOutButton />);
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await waitFor(() => expect(f.signOut).toHaveBeenCalledWith({ callbackUrl: "/login" }));
});

it("submits a participant invite once after sign-in, including under Strict Mode", () => {
  const submit = vi.spyOn(HTMLFormElement.prototype, "requestSubmit").mockImplementation(() => {});
  const action = vi.fn(async () => {});
  const view = render(
    <StrictMode>
      <JoinForm afterSignIn action={action} />
    </StrictMode>,
  );
  view.rerender(
    <StrictMode>
      <JoinForm afterSignIn action={action} />
    </StrictMode>,
  );
  expect(submit).toHaveBeenCalledTimes(1);
});

it("waits for manual confirmation and indicates progress until the join action finishes", async () => {
  let finish!: () => void;
  const action = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  render(<JoinForm afterSignIn={false} action={action} />);
  expect(action).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Join hackathon" }));
  const pending = await screen.findByRole("button", { name: "Joining…" });
  expect(pending.getAttribute("aria-busy")).toBe("true");
  expect(pending.hasAttribute("disabled")).toBe(true);
  finish();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Join hackathon" }).hasAttribute("disabled")).toBe(false),
  );
  expect(action).toHaveBeenCalledOnce();
});

it.each([
  [Privacy, "Privacy Policy"],
  [Terms, "Terms of Service"],
] as const)("provides a navigable policy document", (Page, title) => {
  render(<Page />);
  expect(screen.getByRole("heading", { level: 1, name: title })).toBeDefined();
  for (const link of screen.getAllByRole("link").filter((el) => el.getAttribute("href")?.startsWith("#"))) {
    expect(document.getElementById(link.getAttribute("href")!.slice(1))?.textContent).toBe(link.textContent);
  }
});
