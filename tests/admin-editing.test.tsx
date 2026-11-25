// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionForm } from "@/components/ActionForm";
import { AdminLiveUpdates } from "@/components/admin/AdminLiveUpdates";
import EventForm from "@/components/admin/EventForm";
import { LiveEditor } from "@/components/admin/LiveEditor";
import { TeamSizeRange } from "@/components/admin/TeamSizeRange";
import { adminEvent } from "./admin-fixture";

const { submitAction, router } = vi.hoisted(() => ({
  submitAction: vi.fn(),
  router: { refresh: vi.fn() },
}));
vi.mock("@/lib/actions", () => ({ submitAction }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeEach(() => {
  vi.clearAllMocks();
  submitAction.mockResolvedValue({ success: true, message: "Saved event" });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("event settings", () => {
  it("previews Markdown, edits dated schedule entries and tracks, and submits only on Save", async () => {
    render(<EventForm event={adminEvent} />);
    expect(screen.getByDisplayValue(adminEvent.slug).hasAttribute("readonly")).toBe(true);
    expect((screen.getByLabelText("Event starts") as HTMLInputElement).value).toBe("2026-12-03T17:00");
    fireEvent.change(screen.getByLabelText(/Event description/), {
      target: { value: "**Demo day**" },
    });
    fireEvent.click(screen.getByText("Preview event description"));
    expect(screen.getByText("Demo day").tagName).toBe("STRONG");
    fireEvent.change(screen.getByLabelText(/Event timezone/), {
      target: { value: "UTC" },
    });
    expect(screen.getByText("All dates below use this timezone.")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Add schedule item/ }));
    fireEvent.change(screen.getByLabelText("Time 2"), {
      target: { value: "18:30" },
    });
    fireEvent.change(screen.getByLabelText("Activity 2"), {
      target: { value: "Demos" },
    });
    fireEvent.click(screen.getByLabelText("Remove schedule item 1"));
    fireEvent.change(screen.getByLabelText("Track name 1"), {
      target: { value: "Clean energy" },
    });
    fireEvent.change(screen.getByLabelText("Slider maximum"), {
      target: { value: "3" },
    });
    expect(screen.getByText("1–3 members")).toBeDefined();
    const save = screen.getByRole("button", { name: "Save event" });
    fireEvent.submit((save as HTMLButtonElement).form!);
    expect(submitAction).not.toHaveBeenCalled();
    fireEvent.click(save);
    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1));
    const data: FormData = submitAction.mock.calls[0][1];
    expect(Object.fromEntries(data)).toMatchObject({
      intent: "event.save",
      id: adminEvent.id,
      description: "**Demo day**",
      timezone: "UTC",
      minTeamSize: "1",
      maxTeamSize: "3",
      teamSizeCeiling: "3",
    });
    expect(JSON.parse(String(data.get("original")))).toMatchObject({
      maxTeamSize: "4",
      description: adminEvent.description,
    });
    expect(JSON.parse(String(data.get("tracks")))).toEqual([
      { id: "track-1", name: "Clean energy", description: "" },
    ]);
    expect(JSON.parse(String(data.get("schedule")))).toEqual([{ time: "18:30", label: "Demos" }]);
  });

  it("uses one member when the ceiling is cleared and constrains both handles to the selected range", () => {
    render(<TeamSizeRange minimum={1} maximum={4} ceiling={4} />);
    const limit = screen.getByRole<HTMLInputElement>("spinbutton");
    const low = screen.getByLabelText<HTMLInputElement>("Minimum team size");
    const high = screen.getByLabelText<HTMLInputElement>("Maximum team size");
    fireEvent.change(limit, { target: { value: "0" } });
    expect(limit.value).toBe("4");
    fireEvent.change(limit, { target: { value: "" } });
    expect(screen.getByText("Exactly 1 member")).toBeDefined();
    fireEvent.blur(limit);
    expect(limit.value).toBe("1");
    fireEvent.change(limit, { target: { value: "5" } });
    fireEvent.change(low, { target: { value: "3" } });
    fireEvent.change(high, { target: { value: "2" } });
    expect(screen.getByText("Exactly 3 members")).toBeDefined();
    fireEvent.change(low, { target: { value: "5" } });
    expect([low.value, high.value]).toEqual(["3", "3"]);
  });

  it("separates overlapping handles in either direction and rounds a dragged handle on release", () => {
    render(<TeamSizeRange minimum={2} maximum={2} ceiling={5} />);
    const low = screen.getByLabelText<HTMLInputElement>("Minimum team size");
    const high = screen.getByLabelText<HTMLInputElement>("Maximum team size");
    const rail = low.parentElement!;
    vi.spyOn(rail, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 100, 20));
    Object.defineProperty(rail, "setPointerCapture", { value: vi.fn() });
    function pointer(type: string, x: number, primary = true) {
      const event = new MouseEvent(type, {
        bubbles: true,
        clientX: x,
        button: 0,
      });
      Object.defineProperties(event, {
        isPrimary: { value: primary },
        pointerId: { value: 1 },
      });
      fireEvent(rail, event);
    }
    pointer("pointermove", 100);
    pointer("pointerdown", 100, false);
    expect([low.value, high.value]).toEqual(["2", "2"]);
    pointer("pointerdown", 25);
    pointer("pointermove", 61);
    expect(high.style.left).toBe("61%");
    pointer("lostpointercapture", 61);
    expect(high.style.left).toBe("50%");
    pointer("pointerdown", 100);
    expect(high.value).toBe("5");
    pointer("lostpointercapture", 100);
    pointer("pointerdown", 25);
    pointer("pointermove", 100);
    expect(screen.getByText("Exactly 5 members")).toBeDefined();
    pointer("lostpointercapture", 100);
    pointer("pointerdown", 100);
    pointer("pointermove", 0);
    expect([low.value, high.value]).toEqual(["1", "5"]);
    expect(document.activeElement).toBe(low);
  });
});

describe("collaborative editing", () => {
  function editor(version: string, title: string) {
    return (
      <LiveEditor version={version}>
        <ActionForm intent="event.save">
          <label>
            Event title
            <input name="title" defaultValue={title} />
          </label>
          <button type="submit">Save</button>
        </ActionForm>
      </LiveEditor>
    );
  }

  it("preserves the local draft across refreshes and loads the remote version on discard", () => {
    const view = render(editor("v1", "Original"));
    fireEvent.change(screen.getByLabelText("Event title"), {
      target: { value: "Local draft" },
    });
    view.rerender(editor("v2", "Remote title"));
    expect(screen.getByDisplayValue("Local draft")).toBeDefined();
    expect(screen.getByRole("status").textContent).toContain("Your draft is preserved");
    fireEvent.click(screen.getByRole("button", { name: /Discard my draft/ }));
    expect(screen.getByDisplayValue("Remote title")).toBeDefined();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("releases the draft after saving and announces success across the next refresh", async () => {
    const view = render(editor("v1", "Original"));
    fireEvent.change(screen.getByLabelText("Event title"), {
      target: { value: "Updated" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved event");
    view.rerender(editor("v2", "Updated"));
    expect(screen.getByRole("status").textContent).toBe("Saved event");
    expect(screen.queryByText(/discard my draft/i)).toBeNull();
  });

  it("preserves edits made with a form button or a pointer on the team slider", () => {
    const settings = (version: string) => (
      <LiveEditor version={version}>
        <EventForm event={adminEvent} />
      </LiveEditor>
    );
    const view = render(settings("v1"));
    fireEvent.click(screen.getByRole("button", { name: /Add prize/ }));
    view.rerender(settings("v2"));
    expect(screen.getByLabelText("Prize name 1")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Discard my draft/ }));
    expect(screen.queryByLabelText("Prize name 1")).toBeNull();
    fireEvent.pointerDown(screen.getByLabelText("Maximum team size"));
    view.rerender(settings("v3"));
    expect(screen.getByRole("status").textContent).toContain("Your draft is preserved");
  });

  it("refreshes visible online tabs and releases the polling timer on unmount", () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const online = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
    const view = render(<AdminLiveUpdates />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(router.refresh).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue("visible");
    online.mockReturnValue(false);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(router.refresh).toHaveBeenCalledTimes(1);
    online.mockReturnValue(true);
    fireEvent(window, new Event("online"));
    expect(router.refresh).toHaveBeenCalledTimes(2);
    view.unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    fireEvent(window, new Event("online"));
    expect(router.refresh).toHaveBeenCalledTimes(2);
  });
});
