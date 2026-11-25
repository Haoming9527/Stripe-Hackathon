// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "@/components/CopyButton";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { HeaderAuthButton } from "@/components/HeaderAuthButton";
import { VideoPreview } from "@/components/VideoPreview";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { SiteFrame } from "@/components/SiteFrame";
import { ActionForm, EditSavedContext } from "@/components/ActionForm";
import { ProjectCard, ProjectVote } from "@/components/ProjectCard";

const f = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  viewer: vi.fn(),
  missing: vi.fn(),
  submit: vi.fn(),
}));
vi.mock("next-auth/react", () => ({ signIn: f.signIn, signOut: f.signOut }));
vi.mock("@/lib/auth", () => ({ getViewer: f.viewer, missingAuthSettings: f.missing }));
vi.mock("@/lib/actions", () => ({ submitAction: f.submit }));
vi.mock("next/navigation", () => ({ usePathname: () => window.location.pathname }));

beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, "", "/");
  f.missing.mockReturnValue([]);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("site navigation and sign-in", () => {
  it("shows the active admin link, uses initials when an avatar fails and offers sign-out", async () => {
    window.history.replaceState(null, "", "/admin/event");
    f.viewer.mockResolvedValue({
      email: "sam@example.com",
      name: "Sam",
      image: "https://example.com/photo.jpg",
      isAdmin: true,
    });
    render(
      <SiteFrame header={await SiteHeader()} footer={<SiteFooter />}>
        Event settings
      </SiteFrame>,
    );
    expect(screen.getByRole("main").textContent).toBe("Event settings");
    expect(screen.getByRole("link", { name: "Admin" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("img", { name: "Stripe Community" }).getAttribute("loading")).toBe("eager");
    fireEvent.error(screen.getByRole("img", { name: /Google profile photo/ }));
    expect(screen.getByTitle("sam@example.com").textContent).toBe("S");
    expect(screen.getByRole("link", { name: "Star on GitHub" }).getAttribute("href")).toBe(
      "https://github.com/Haoming9527/Stripe-Hackathon",
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(f.signOut).toHaveBeenCalledWith({ callbackUrl: "/" });
  });

  it("disables guest sign-in when the provider is unavailable", async () => {
    f.viewer.mockResolvedValue(null);
    f.missing.mockReturnValue(["GOOGLE_CLIENT_ID"]);
    render(await SiteHeader());
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
    expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("retries a failed header sign-in with the local callback from the login URL", async () => {
    window.history.replaceState(null, "", "/login?callbackUrl=%2Fhackathons%2Fbuild");
    f.signIn.mockRejectedValueOnce(new Error("unavailable"));
    render(<HeaderAuthButton signedIn={false} />);
    const button = screen.getByRole("button", { name: "Sign in" });
    fireEvent.click(button);
    expect((await screen.findByRole("alert")).textContent).toContain("try again");
    fireEvent.click(button);
    expect(f.signIn).toHaveBeenCalledTimes(2);
    expect(f.signIn).toHaveBeenLastCalledWith(
      "google",
      { callbackUrl: "/hackathons/build" },
      { prompt: "select_account" },
    );
  });

  it("preserves the invitation URL across sign-in and surfaces provider errors", async () => {
    window.history.replaceState(null, "", "/invite/abc?role=member#join");
    f.signIn.mockRejectedValueOnce(new Error("offline"));
    render(
      <GoogleSignInButton disabled={false} className="button">
        Join with Google
      </GoogleSignInButton>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Join with Google" }));
    expect(f.signIn).toHaveBeenCalledWith(
      "google",
      { callbackUrl: "/invite/abc?role=member#join" },
      { prompt: "select_account" },
    );
    expect((await screen.findByRole("alert")).textContent).toMatch(/Sign-in could not start/);
    fireEvent.click(screen.getByRole("button", { name: "Join with Google" }));
    expect((screen.getByRole("button", { name: "Opening Google…" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

describe("participant actions", () => {
  it("preserves unsaved form input after an error and notifies the editor only after a successful save", async () => {
    const saved = vi.fn();
    f.submit
      .mockResolvedValueOnce({ success: false, message: "Name taken" })
      .mockResolvedValueOnce({ success: true, message: "Updated team" });
    render(
      <EditSavedContext.Provider value={saved}>
        <ActionForm intent="team.create" successMessage="Saved" requireSubmitButton>
          <input aria-label="Team name" name="name" />
          <button name="save" value="yes">
            Save team
          </button>
        </ActionForm>
      </EditSavedContext.Provider>,
    );
    const input = screen.getByRole("textbox") as HTMLInputElement;
    const button = screen.getByRole("button");
    fireEvent.change(input, { target: { value: "Orbit" } });
    expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(false);
    fireEvent.submit(input.form!);
    expect(f.submit).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect((await screen.findByRole("alert")).textContent).toBe("Name taken");
    expect(input.value).toBe("Orbit");
    expect(saved).not.toHaveBeenCalled();
    expect(Object.fromEntries(f.submit.mock.calls[0][1] as FormData)).toEqual({
      intent: "team.create",
      name: "Orbit",
      save: "yes",
    });
    fireEvent.click(button);
    expect((await screen.findByText("Saved")).getAttribute("role")).toBe("status");
    expect(saved).toHaveBeenCalledWith("Updated team");
  });

  it("copies an absolute share link and offers a manual fallback on clipboard failure", async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error("denied")).mockResolvedValue(undefined);
    vi.stubGlobal("navigator", Object.create(window.navigator, { clipboard: { value: { writeText } } }));
    render(<CopyButton value="/hackathons/build/projects/demo" share />);
    const button = screen.getByRole("button", { name: "Copy project link" });
    fireEvent.click(button);
    expect((await screen.findByRole("alert")).textContent).toContain("copy the text manually");
    fireEvent.click(button);
    await screen.findByText("Copied");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(writeText).toHaveBeenLastCalledWith(window.location.origin + "/hackathons/build/projects/demo");
  });
});

describe("public project cards", () => {
  const state = { signedIn: true, open: true, remaining: 1, own: false, voted: false };
  it.each([
    [{ own: true }, "Your team’s project"],
    [{ open: false }, "Voting closed"],
    [{ open: false, voted: true }, "You voted"],
    [{ signedIn: false }, "Sign in to vote"],
    [{ remaining: 0 }, "All votes used"],
    [{ voted: true }, "Voted · undo"],
  ] as const)("explains vote availability (%o)", (overrides, label) => {
    render(<ProjectVote projectId="demo" state={{ ...state, ...overrides }} />);
    expect(screen.getByText(label)).toBeDefined();
    if (label === "All votes used")
      expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("links to the published project and its demo and submits a vote for the displayed project", async () => {
    const project = {
      id: "demo",
      teamId: "t1",
      name: "Energy map",
      team: { name: "Orbit" },
      tracks: [{ track: { id: "web", name: "Web" } }],
      description: "Energy monitor",
      demoUrl: "https://example.org/demo",
      githubUrl: "https://github.com/example/demo",
      videoUrl: "",
      publishedAt: new Date(),
    };
    f.submit.mockResolvedValue({ success: true, message: "Vote recorded" });
    render(<ProjectCard project={project} slug="build" vote={state} />);
    const card = within(screen.getByRole("article"));
    expect(card.getByRole("link", { name: project.name }).getAttribute("href")).toBe(
      "/hackathons/build/projects/demo",
    );
    expect(card.getByRole("link", { name: "Demo link" }).getAttribute("href")).toBe(project.demoUrl);
    expect(card.getByRole("list").textContent).toContain("Web");
    fireEvent.click(card.getByRole("button", { name: "Vote for project" }));
    await waitFor(() => expect(f.submit).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(f.submit.mock.calls[0][1] as FormData)).toEqual({
      intent: "vote.add",
      projectId: "demo",
    });
  });

  it("starts a privacy-enhanced YouTube embed even when its thumbnail fails", () => {
    const { container } = render(<VideoPreview name="Energy map" videoUrl="https://youtu.be/dQw4w9WgXcQ" />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Play Energy map/ }));
    expect(screen.getByTitle("Energy map demo video").getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1",
    );
  });

  it("offers the original video link after a media failure and skips unsafe demo links", () => {
    const url = "https://example.org/demo.mp4";
    const { rerender, container } = render(<VideoPreview name="Map" videoUrl={url} />);
    fireEvent.error(screen.getByLabelText("Map demo video"));
    expect(screen.getByRole("link", { name: "Watch Map video" }).getAttribute("href")).toBe(url);
    rerender(<VideoPreview name="Map" demoUrl="javascript:void(0)" />);
    expect(container.childElementCount).toBe(0);
  });
});
