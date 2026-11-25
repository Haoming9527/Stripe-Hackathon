import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { submitAction } from "../lib/actions";
import { requireUser } from "../lib/auth";
import { performMutation } from "../lib/domain";
import { DomainError } from "../lib/validation";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../lib/auth", () => ({ requireUser: vi.fn() }));
vi.mock("../lib/domain", () => ({ performMutation: vi.fn() }));

const viewer = { id: "u1", email: "owner@example.test", name: null, image: null, isAdmin: false };
const previous = { success: false, message: "" };

function submit(intent: string) {
  const form = new FormData();
  form.set("intent", intent);
  return submitAction(previous, form);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireUser).mockResolvedValue(viewer);
});

afterEach(() => vi.restoreAllMocks());

describe("form actions", () => {
  it("returns the participant's success message and refreshes the application", async () => {
    vi.mocked(performMutation).mockResolvedValue({ message: "Team created." });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await expect(submit("team.create")).resolves.toEqual({ success: true, message: "Team created." });
    expect(performMutation).toHaveBeenCalledWith("team.create", expect.any(FormData), viewer);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
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
    expect(redirect).toHaveBeenCalledWith("/admin/new-event");
    expect(JSON.parse(info.mock.calls[0][0])).toMatchObject({
      actorId: viewer.id,
      intent: "event.save",
      event: "mutation.succeeded",
    });
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
    expect(revalidatePath).not.toHaveBeenCalled();
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
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("requires an authenticated viewer before dispatching a mutation", async () => {
    const navigation = new Error("sign-in redirect");
    vi.mocked(requireUser).mockRejectedValue(navigation);
    await expect(submit("team.create")).rejects.toBe(navigation);
    expect(performMutation).not.toHaveBeenCalled();
  });
});
