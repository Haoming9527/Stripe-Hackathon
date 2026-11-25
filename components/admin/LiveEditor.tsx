"use client";

import { Fragment, useState, type ReactNode } from "react";
import { EditSavedContext } from "@/components/ActionForm";

export function LiveEditor({
  version,
  children,
}: {
  version: string;
  children: ReactNode;
}) {
  const [draft, setDraft] = useState<{
    version: string;
    children: ReactNode;
  } | null>(null);
  const changed = draft !== null && draft.version !== version;
  const [notice, setNotice] = useState<{
    version: string;
    message: string;
  } | null>(null);
  function saved(message: string) {
    setNotice({ version: draft?.version ?? version, message });
    setDraft(null);
  }
  function preserveDraft() {
    setNotice(null);
    setDraft((previous) => previous ?? { version, children });
  }
  return (
    <>
      {changed && (
        <div className="notice" role="status">
          Another organizer saved changes. Your draft is preserved.{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => setDraft(null)}
          >
            Discard my draft and load updates
          </button>
        </div>
      )}
      <div
        onChangeCapture={preserveDraft}
        onSubmitCapture={preserveDraft}
        onClickCapture={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest('button[type="button"]')
          )
            preserveDraft();
        }}
      >
        <EditSavedContext.Provider value={saved}>
          <Fragment key={draft?.version ?? version}>{draft?.children ?? children}</Fragment>
        </EditSavedContext.Provider>
      </div>
      {notice && notice.version !== version && (
        <div role="status" className="notice notice-success">
          {notice.message}
        </div>
      )}
    </>
  );
}
