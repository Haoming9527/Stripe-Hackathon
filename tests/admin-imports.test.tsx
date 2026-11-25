// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CreditAllocationForm,
  ParticipantImportForm,
  VoucherImportForm,
} from "@/components/admin/ImportForms";

const { submitAction } = vi.hoisted(() => ({ submitAction: vi.fn() }));
vi.mock("@/lib/actions", () => ({ submitAction }));
beforeEach(() => {
  submitAction.mockReset().mockResolvedValue({ success: true, message: "Saved" });
});
afterEach(cleanup);

describe("participant imports", () => {
  it("previews new, existing and duplicate addresses, then sends the reviewed list", async () => {
    render(<ParticipantImportForm hackathonId="event" existingEmails={["a@example.org"]} />);
    const button = screen.getByRole<HTMLButtonElement>("button", {
      name: "Import participants",
    });
    const input = screen.getByRole("textbox");
    expect(button.disabled).toBe(true);
    const list = "A@example.org\nb@example.org\nB@example.org";
    fireEvent.change(input, { target: { value: list + "\ninvalid" } });
    expect(screen.getByRole("alert").textContent).toContain("Fix 1 invalid address");
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: list } });
    expect(screen.getByText("new participants").textContent).toBe("1 new participants");
    expect(screen.getByText("already invited").textContent).toBe("1 already invited");
    expect(screen.getByText("duplicates ignored").textContent).toBe("1 duplicates ignored");
    fireEvent.click(button);
    await waitFor(() => expect(submitAction).toHaveBeenCalledOnce());
    expect(Object.fromEntries(submitAction.mock.calls[0][1])).toMatchObject({
      intent: "participants.import",
      hackathonId: "event",
      emails: list,
    });
  });

  it("summarizes longer invalid lists and explains a malformed CSV", () => {
    render(<ParticipantImportForm hackathonId="event" existingEmails={[]} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, {
      target: {
        value: Array.from({ length: 9 }, (_, i) => "bad" + i).join("\n"),
      },
    });
    expect(screen.getByRole("alert").textContent).toMatch(/9 invalid addresses.*bad7…$/);
    fireEvent.change(input, { target: { value: 'email,name\n"unterminated' } });
    expect(screen.getByRole("alert").textContent).toContain("CSV could not be read");
  });

  it("loads the chosen file, shows a reading state, and recovers from unreadable or oversized files", async () => {
    render(<ParticipantImportForm hackathonId="event" existingEmails={[]} />);
    const fileInput = screen.getByLabelText<HTMLInputElement>("Upload a participant list");
    const open = vi.spyOn(fileInput, "click");
    fireEvent.click(screen.getByRole("button", { name: "Upload CSV or TXT" }));
    expect(open).toHaveBeenCalledOnce();
    const upload = (files: unknown[]) => fireEvent.change(fileInput, { target: { files } });
    upload([]);
    expect(screen.getByText("Up to 1 MB")).toBeDefined();
    upload([{ name: "large.csv", size: 1_000_001 }]);
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Choose a file smaller than 1 MB.",
    );
    await screen.findByRole("button", { name: "Upload CSV or TXT" });
    upload([
      {
        name: "unreadable.csv",
        size: 50,
        text: async () => {
          throw new Error("read failed");
        },
      },
    ]);
    await screen.findByText(/This file could not be read/);
    const contents = Promise.withResolvers<string>();
    upload([{ name: "people.csv", size: 20, text: () => contents.promise }]);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Reading file..." }).disabled).toBe(true);
    contents.resolve("person@example.org");
    await screen.findByText("Loaded people.csv");
    expect(screen.getByDisplayValue("person@example.org")).toBeDefined();
    expect(screen.getByRole("button", { name: "Replace file" })).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("credit inventory", () => {
  it("shows import errors and previews unique codes before adding inventory", async () => {
    render(<VoucherImportForm offerId="credit" />);
    const input = screen.getByRole("textbox");
    const button = screen.getByRole<HTMLButtonElement>("button", {
      name: "Add to inventory",
    });
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "a".repeat(4097) } });
    expect(screen.getByRole("alert").textContent).toContain("4,096");
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "code\nONE\nTWO\nONE" } });
    expect(screen.getByText("unique vouchers").textContent).toBe("2 unique vouchers");
    expect(screen.getByText("duplicates ignored").textContent).toBe("1 duplicates ignored");
    fireEvent.click(button);
    await waitFor(() => expect(submitAction).toHaveBeenCalledOnce());
    expect(Object.fromEntries(submitAction.mock.calls[0][1])).toMatchObject({
      offerId: "credit",
      intent: "credits.import",
      codes: "code\nONE\nTWO\nONE",
    });
  });

  it("prevents partial allocations and checks eligibility again when the roster refreshes", async () => {
    const roster = [
      {
        id: "1",
        normalizedEmail: "one@example.org",
        name: "One",
        assigned: false,
      },
      {
        id: "2",
        normalizedEmail: "two@example.org",
        name: null,
        assigned: false,
      },
      {
        id: "3",
        normalizedEmail: "three@example.org",
        name: null,
        assigned: true,
      },
    ];
    const view = render(<CreditAllocationForm offerId="credit" available={1} participants={roster} />);
    expect(screen.getByText(/Add 1 more voucher/)).toBeDefined();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Assign 2 vouchers",
      }).disabled,
    ).toBe(true);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "selected" },
    });
    expect(screen.queryByLabelText("three@example.org")).toBeNull();
    const one = screen.getByLabelText(/one@example.org/);
    fireEvent.click(one);
    fireEvent.click(screen.getByLabelText("two@example.org"));
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Assign 2 vouchers",
      }).disabled,
    ).toBe(true);
    fireEvent.click(one);
    const updated = roster.map((person) => ({
      ...person,
      assigned: person.id !== "2",
    }));
    view.rerender(<CreditAllocationForm offerId="credit" available={1} participants={updated} />);
    fireEvent.click(screen.getByRole("button", { name: "Assign 1 voucher" }));
    await waitFor(() => expect(submitAction).toHaveBeenCalledOnce());
    const data: FormData = submitAction.mock.calls[0][1];
    expect(data.getAll("participantIds")).toEqual(["2"]);
    expect(data.get("allocationMode")).toBe("selected");
    view.rerender(
      <CreditAllocationForm
        offerId="credit"
        available={0}
        participants={updated.map((person) => ({ ...person, assigned: true }))}
      />,
    );
    expect(screen.getByText("Everyone already has an allocation.")).toBeDefined();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Assign vouchers" }).disabled).toBe(true);
  });
});
