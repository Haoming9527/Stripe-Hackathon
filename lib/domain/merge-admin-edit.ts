import type { EditValues } from "../admin-edit";
import { assert, DomainError } from "../validation";

/** Resolve the submitted draft against the record read in the write transaction. */
export function mergeAdminEdit(
  form: FormData,
  current: EditValues,
  lists: string[] = [],
) {
  let original: EditValues;
  try {
    original = JSON.parse(String(form.get("original")));
  } catch {
    throw new DomainError("Reload this editor to get the latest saved values.");
  }
  const merged = new FormData();
  for (const [key, saved] of Object.entries(current)) {
    assert(
      original && typeof original[key] === "string",
      "Reload this editor to get the latest saved values.",
    );
    const base = original[key];
    const submitted = String(form.get(key) ?? "").replace(/\r\n/g, "\n");
    if (submitted === base) merged.set(key, saved);
    else if (saved === base || submitted === saved) merged.set(key, submitted);
    else {
      // Rows without persistent IDs can still be safely appended to the latest list.
      if (lists.includes(key)) {
        try {
          const [before, draft, latest] = [base, submitted, saved].map(
            (value) => JSON.parse(value),
          );
          if (
            [before, draft, latest].every(Array.isArray) &&
            draft.length > before.length &&
            JSON.stringify(draft.slice(0, before.length)) ===
              JSON.stringify(before)
          ) {
            merged.set(
              key,
              JSON.stringify([...latest, ...draft.slice(before.length)]),
            );
            continue;
          }
        } catch {
          /* Invalid or incompatible lists cannot be merged. */
        }
      }
      throw new DomainError(
        `Another admin changed ${key}. Your draft is still here. Copy your edit, then reload to review the latest version before saving.`,
      );
    }
  }
  return merged;
}
