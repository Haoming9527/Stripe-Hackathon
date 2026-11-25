"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { parseParticipants, parseVoucherValues } from "@/lib/validation";
import { countImportedEmails } from "./count-imported-emails";
import styles from "./styles";

async function readImport(
  event: ChangeEvent<HTMLInputElement>,
  update: (text: string) => void,
  setError: (message: string) => void,
) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 1_000_000) {
    setError("Choose a file smaller than 1 MB.");
    event.target.value = "";
    return;
  }
  try {
    update(await file.text());
    setError("");
  } catch {
    setError("This file could not be read. Try pasting its contents instead.");
  }
  event.target.value = "";
}

function ImportFileControl({
  label,
  onImport,
  onError,
}: {
  label: string;
  onImport: (text: string) => void;
  onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFilename("");
    setLoading(true);
    try {
      await readImport(
        event,
        (value) => {
          onImport(value);
          setFilename(file.name);
        },
        onError,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.fileImport}>
      <input
        ref={input}
        type="file"
        hidden
        aria-label={label}
        accept=".csv,.txt,text/csv,text/plain"
        onChange={loadFile}
      />
      <button
        type="button"
        className={styles.fileImportButton}
        onClick={() => input.current?.click()}
        disabled={loading}
      >
        <Upload size={16} aria-hidden="true" />
        {loading
          ? "Reading file..."
          : filename
            ? "Replace file"
            : "Upload CSV or TXT"}
      </button>
      <span className={styles.fileImportHint} role="status">
        {filename ? `Loaded ${filename}` : "Up to 1 MB"}
      </span>
    </div>
  );
}

export function ParticipantImportForm({
  hackathonId,
  existingEmails,
  rosterSize,
}: {
  hackathonId: string;
  existingEmails?: string[];
  rosterSize?: number;
}) {
  const [text, setText] = useState("");
  const [fileError, setFileError] = useState("");
  const preview = useMemo(() => {
    if (!text.trim())
      return { participants: [], invalid: [], duplicates: 0, error: "" };
    try {
      return { ...parseParticipants(text), error: "" };
    } catch (error) {
      return {
        participants: [],
        invalid: [],
        duplicates: 0,
        error:
          error instanceof Error
            ? error.message
            : "The import could not be read.",
      };
    }
  }, [text]);
  const [lookup, setLookup] = useState<{
    preview: typeof preview;
    rosterSize?: number;
    hackathonId: string;
    count: number | null;
  }>();
  const localAddresses = useMemo(() => existingEmails && new Set(existingEmails), [existingEmails]);
  useEffect(() => {
    if (localAddresses || !preview.participants.length) return;
    let current = true;
    const timer = window.setTimeout(async () => {
      const emails = preview.participants.map((row) => row.normalizedEmail);
      const count = await countImportedEmails(hackathonId, emails).catch(() => null);
      if (current) setLookup({ preview, rosterSize, hackathonId, count });
    }, 300);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [hackathonId, localAddresses, preview, rosterSize]);
  let alreadyAdded: number | null | undefined;
  if (localAddresses) {
    alreadyAdded = preview.participants.filter((row) => localAddresses.has(row.normalizedEmail)).length;
  } else if (!preview.participants.length) {
    alreadyAdded = 0;
  } else if (lookup?.preview === preview && lookup.rosterSize === rosterSize && lookup.hackathonId === hackathonId) {
    alreadyAdded = lookup.count;
  }
  return (
    <ActionForm intent="participants.import">
      <input type="hidden" name="hackathonId" value={hackathonId} />
      <div className={styles.fields}>
        <div className={styles.field}>
          <span>Upload a participant list</span>
          <ImportFileControl
            label="Upload a participant list"
            onImport={setText}
            onError={setFileError}
          />
          <small>
            CSV with an email column and optional name column, or one email per
            line. Up to 5,000 people per import.
          </small>
        </div>
        <label className={styles.field}>
          Or paste email addresses
          <textarea
            name="emails"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setFileError("");
            }}
            rows={4}
            placeholder={
              "alex@example.com\njordan@example.com\nsam@example.com"
            }
            maxLength={1000000}
          />
          <small>One email per line, or paste a CSV with an email column.</small>
        </label>
      </div>
      {text.trim() && (
        <div className={styles.previewStats} aria-live="polite">
          {typeof alreadyAdded === "number" ? (
            <>
              <span><strong>{preview.participants.length - alreadyAdded}</strong> new participants</span>
              <span><strong>{alreadyAdded}</strong> already invited</span>
            </>
          ) : (
            <span>{alreadyAdded === null ? "Existing addresses will be checked during import." : "Checking existing participants…"}</span>
          )}
          <span>
            <strong>{preview.duplicates}</strong> duplicates ignored
          </span>
        </div>
      )}
      {(preview.error || fileError || preview.invalid.length > 0) && (
        <div className={styles.errors} role="alert">
          {preview.error || fileError || (
            <>
              <strong>
                Fix {preview.invalid.length} invalid{" "}
                {preview.invalid.length === 1 ? "address" : "addresses"} before
                importing:
              </strong>
              <br />
              {preview.invalid.slice(0, 8).join(", ")}
              {preview.invalid.length > 8 ? "…" : ""}
            </>
          )}
        </div>
      )}
      <div className={styles.importActions}>
        <button
          className="button button-primary"
          type="submit"
          disabled={
            !preview.participants.length ||
            !!preview.error ||
            !!fileError ||
            preview.invalid.length > 0
          }
        >
          Import participants
        </button>
      </div>
      <p className={styles.subtle} style={{ marginTop: 12 }}>
        Existing participants keep their team, submissions, and credit
        allocations. Importing does not send an email.
      </p>
    </ActionForm>
  );
}

export function VoucherImportForm({ offerId }: { offerId: string }) {
  const [text, setText] = useState("");
  const [fileError, setFileError] = useState("");
  const preview = useMemo(() => {
    if (!text.trim()) return { values: [], duplicates: 0, error: "" };
    try {
      return { ...parseVoucherValues(text), error: "" };
    } catch (error) {
      return {
        values: [],
        duplicates: 0,
        error:
          error instanceof Error
            ? error.message
            : "The import could not be read.",
      };
    }
  }, [text]);
  return (
    <ActionForm intent="credits.import">
      <input type="hidden" name="offerId" value={offerId} />
      <div className={styles.fields}>
        <label className={styles.field}>
          Unique codes or redemption links
          <textarea
            name="codes"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setFileError("");
            }}
            rows={5}
            placeholder={"One unique code or link per line"}
            maxLength={1000000}
          />
          <small>
            For CSV files, use a code, url, link, or value column. Duplicate
            inventory is skipped.
          </small>
        </label>
        <div className={styles.field}>
          <span>Or import from a file</span>
          <ImportFileControl
            label="Import voucher file"
            onImport={setText}
            onError={setFileError}
          />
        </div>
      </div>
      {text.trim() && (
        <div className={styles.previewStats}>
          <span>
            <strong>{preview.values.length}</strong> unique vouchers
          </span>
          <span>
            <strong>{preview.duplicates}</strong> duplicates ignored
          </span>
        </div>
      )}
      {(preview.error || fileError) && (
        <div className={styles.errors} role="alert">
          {preview.error || fileError}
        </div>
      )}
      <div className={styles.importActions}>
        <button
          className="button button-primary"
          type="submit"
          disabled={!preview.values.length || !!preview.error || !!fileError}
        >
          Add to inventory
        </button>
      </div>
    </ActionForm>
  );
}

export function CreditAllocationForm({
  offerId,
  available,
  participants,
}: {
  offerId: string;
  available: number;
  participants: {
    id: string;
    normalizedEmail: string;
    name: string | null;
    assigned: boolean;
  }[];
}) {
  const [mode, setMode] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const eligible = participants.filter((participant) => !participant.assigned);
  const eligibleIds = new Set(eligible.map((participant) => participant.id));
  const selectedEligible = selected.filter((id) => eligibleIds.has(id));
  const required = mode === "all" ? eligible.length : selectedEligible.length;
  const shortage = Math.max(0, required - available);
  return (
    <ActionForm intent="credits.assign">
      <input type="hidden" name="offerId" value={offerId} />
      <input type="hidden" name="allocationMode" value={mode} />
      <label className={styles.field}>
        Who should receive this offer?
        <select value={mode} onChange={(event) => setMode(event.target.value)}>
          <option value="all">
            Everyone without an allocation ({eligible.length})
          </option>
          <option value="selected">Choose participants</option>
        </select>
      </label>
      {mode === "selected" && (
        <div
          style={{
            maxHeight: 230,
            overflow: "auto",
            marginTop: 14,
            border: "1px solid #e3e9f0",
            borderRadius: 6,
            padding: 14,
          }}
        >
          {eligible.length ? (
            eligible.map((participant) => (
              <label
                className={styles.check}
                key={participant.id}
                style={{ paddingBlock: 5 }}
              >
                <input
                  type="checkbox"
                  name="participantIds"
                  value={participant.id}
                  checked={selected.includes(participant.id)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, participant.id]
                        : current.filter((id) => id !== participant.id),
                    )
                  }
                />
                <span>
                  {participant.name && <strong>{participant.name} · </strong>}
                  {participant.normalizedEmail}
                </span>
              </label>
            ))
          ) : (
            <p className={styles.subtle}>Everyone already has an allocation.</p>
          )}
        </div>
      )}
      <div className={styles.previewStats}>
        <span>
          <strong>{required}</strong> vouchers needed
        </span>
        <span>
          <strong>{available}</strong> available
        </span>
      </div>
      {shortage > 0 && (
        <div className={styles.errors}>
          Add {shortage} more {shortage === 1 ? "voucher" : "vouchers"} before
          allocating. Nobody will receive a partial allocation.
        </div>
      )}
      <button
        className="button button-primary"
        type="submit"
        disabled={required === 0 || shortage > 0}
      >
        Assign {required || ""} {required === 1 ? "voucher" : "vouchers"}
      </button>
      <p className={styles.subtle} style={{ marginTop: 12 }}>
        One unique voucher per person. Already assigned vouchers stay with their
        recipients.
      </p>
    </ActionForm>
  );
}
