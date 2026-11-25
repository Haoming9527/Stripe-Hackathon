import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { submitAction } from "../lib/actions";
import { requireUser } from "../lib/auth";
import { performMutation } from "../lib/domain";
import { DomainError } from "../lib/validation";

vi.mock("next/cache", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/cache")>(),
  refresh: vi.fn(),
  updateTag: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../lib/auth", () => ({ requireUser: vi.fn() }));
vi.mock("../lib/domain", () => ({ performMutation: vi.fn() }));

const viewer = { id: "u1", email: "owner@example.test", name: null, image: null, isAdmin: false };
const previous = { success: false, message: "" };

function submit(intent: string, publish = false) {
  const form = new FormData();
  form.set("intent", intent);
  if (publish) form.set("publish", "true");
  return submitAction(previous, form);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireUser).mockResolvedValue(viewer);
});

afterEach(() => vi.restoreAllMocks());

describe("form actions", () => {
  it("refreshes the participant's view and keeps shared data cached after a team change", async () => {
    vi.mocked(performMutation).mockResolvedValue({ message: "Team created." });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await expect(submit("team.create")).resolves.toEqual({ success: true, message: "Team created." });
    expect(performMutation).toHaveBeenCalledWith("team.create", expect.any(FormData), viewer);
    expect(refresh).toHaveBeenCalledOnce();
    expect(updateTag).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it("logs organizer changes and propagates navigation after a successful create", async () => {
    vi.mocked(requireUser).mockResolvedValue({ ...viewer, isAdmin: true });
    vi.mocked(performMutation).mockResolvedValue({ message: "Saved.", redirectTo: "/admin/new-event" });
    const navigation = new Error("redirect");
    vi.mocked(redirect).mockImplementation(() => {
      throw navigation;
    });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await expect(submit("event.save")).rejects.toBe(navigation);
    expect(updateTag).toHaveBeenCalledWith("public-featured-event");
    expect(redirect).toHaveBeenCalledWith("/admin/new-event");
    expect(JSON.parse(info.mock.calls[0][0])).toMatchObject({
      actorId: viewer.id,
      intent: "event.save",
      event: "mutation.succeeded",
    });
  });

  it.each(["event.delete", "event.status"])("expires featured data after %s", async (intent) => {
    vi.mocked(requireUser).mockResolvedValue({ ...viewer, isAdmin: true });
    vi.mocked(performMutation).mockResolvedValue({ message: "Updated." });
    vi.spyOn(console, "info").mockImplementation(() => {});
    await submit(intent);
    expect(updateTag).toHaveBeenCalledWith("public-featured-event");
    expect(updateTag).toHaveBeenCalledWith("public-event-directory");
  });

  it("expires directory project counts on publication and moderation, keeping them cached on draft saves", async () => {
    vi.mocked(performMutation).mockResolvedValue({ message: "Saved." });
    await submit("project.save");
    expect(updateTag).not.toHaveBeenCalled();
    await submit("project.save", true);
    await submit("project.moderate");
    expect(vi.mocked(updateTag).mock.calls).toEqual([["public-event-directory"], ["public-event-directory"]]);
  });

  it("returns bounded validation feedback and keeps arbitrary form input out of the audit log", async () => {
    const message = "x".repeat(550);
    vi.mocked(performMutation).mockRejectedValue(new DomainError(message));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(submit(viewer.email)).resolves.toEqual({ success: false, message: message.slice(0, 500) });
    expect(JSON.parse(warn.mock.calls[0][0])).toMatchObject({
      event: "mutation.rejected",
      intent: "unknown",
    });
    expect(warn.mock.calls[0][0]).not.toContain(viewer.email);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("keeps unexpected service errors out of browser feedback and logs", async () => {
    const failure = "private service diagnostic";
    vi.mocked(performMutation).mockRejectedValue(new Error(failure));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const state = await submit("event.save");
    expect(state.success).toBe(false);
    expect(state.message).toContain("try again");
    expect(state.message).not.toContain(failure);
    expect(JSON.parse(error.mock.calls[0][0])).toMatchObject({
      event: "mutation.failed",
      intent: "event.save",
    });
    expect(error.mock.calls[0][0]).not.toContain(failure);
    expect(updateTag).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("requires an authenticated viewer before dispatching a mutation", async () => {
    const navigation = new Error("sign-in redirect");
    vi.mocked(requireUser).mockRejectedValue(navigation);
    await expect(submit("team.create")).rejects.toBe(navigation);
    expect(performMutation).not.toHaveBeenCalled();
  });
});
