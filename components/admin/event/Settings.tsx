import { ActionForm } from "@/components/ActionForm";
import EventForm from "../EventForm";
import { LiveEditor } from "../LiveEditor";
import styles from "../styles";
import type { EventDetails } from "./types";

export function Settings({ event }: { event: EventDetails }) {
  return (
    <>
      <LiveEditor version={event.updatedAt.toISOString()}><EventForm event={event} /></LiveEditor>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <h2>Delete hackathon</h2>
            <p>
              Permanently delete {event.title}, including its participants,
              teams, projects, votes, and credit inventory. User accounts are
              kept. This cannot be undone.
            </p>
          </div>
        </div>
        <div className={styles.sectionBody}>
          <ActionForm intent="event.delete" className="stack">
            <input type="hidden" name="hackathonId" value={event.id} />
            <label className={styles.field}>
              Type {event.slug} to confirm
              <input
                name="confirmation"
                required
                autoComplete="off"
                maxLength={200}
              />
            </label>
            <button type="submit" className="button button-secondary">
              Delete hackathon permanently
            </button>
          </ActionForm>
        </div>
      </section>
    </>
  );
}
