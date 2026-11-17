import Link from "next/link";
import { windowIsOpen } from "@/lib/validation";
import { ActionForm } from "@/components/ActionForm";
import { eventDate } from "../format";
import styles from "../styles";
import { Status } from "./Status";
import type { EventDetails } from "./types";

export function Overview({ event }: { event: EventDetails }) {
  const submissionsOpen = windowIsOpen(event, "submission");
  const votingOpen = windowIsOpen(event, "voting");
  return (
    <>
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span>Participants</span>
          <strong>{event._count.participants}</strong>
        </div>
        <div className={styles.metric}>
          <span>Teams</span>
          <strong>{event._count.teams}</strong>
        </div>
        <div className={styles.metric}>
          <span>Projects</span>
          <strong>{event._count.projects}</strong>
        </div>
        <div className={styles.metric}>
          <span>Votes · organizers only</span>
          <strong>{event._count.votes}</strong>
        </div>
      </div>
      <div className={styles.split}>
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <h2>Event at a glance</h2>
              <p>
                {eventDate(event.startsAt, event.timezone)} · {event.timezone}
              </p>
            </div>
            <Status status={event.status} />
          </div>
          <div className={styles.sectionBody}>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.8,
                color: "#425a70",
                whiteSpace: "pre-wrap",
              }}
            >
              {event.description ||
                "Add a description in event settings to give participants a clear brief."}
            </p>
            <hr className={styles.divider} />
            <div className={styles.columns}>
              <div>
                <p className={styles.subtle}>Location</p>
                <strong style={{ fontSize: 14 }}>
                  {event.location || "Not set"}
                </strong>
              </div>
              <div>
                <p className={styles.subtle}>Team size</p>
                <strong style={{ fontSize: 14 }}>
                  1–{event.maxTeamSize} participants
                </strong>
              </div>
              <div>
                <p className={styles.subtle}>Tracks</p>
                <strong style={{ fontSize: 14 }}>
                  {event.tracks.length
                    ? `${event.tracks.length} tracks · select up to ${event.maxTrackSelections}`
                    : "No tracks"}
                </strong>
              </div>
              <div>
                <p className={styles.subtle}>Voting allowance</p>
                <strong style={{ fontSize: 14 }}>
                  {event.votesPerUser} per person
                </strong>
              </div>
            </div>
            <hr className={styles.divider} />
            <Link
              className={styles.textLink}
              href={`/admin/${event.id}?tab=settings`}
            >
              Edit event details →
            </Link>
          </div>
        </section>
        <div>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2>Event controls</h2>
            </div>
            <div className={styles.sectionBody}>
              <ActionForm intent="event.status">
                <input type="hidden" name="hackathonId" value={event.id} />
                <label className={styles.field}>
                  Event status
                  <select name="status" defaultValue={event.status}>
                    <option value="DRAFT" disabled={event.status !== "DRAFT"}>
                      Draft
                    </option>
                    <option value="ACTIVE">Active</option>
                    <option value="ENDED">Ended</option>
                  </select>
                </label>
                <button
                  type="submit"
                  className="button button-secondary"
                  style={{ marginTop: 14 }}
                >
                  Update status
                </button>
              </ActionForm>
              <p className={styles.subtle} style={{ marginTop: 14 }}>
                Ending an event closes submissions and voting. Its gallery stays
                public, and unexpired credits remain claimable.
              </p>
              <hr className={styles.divider} />
              <ActionForm intent="event.windows">
                <input type="hidden" name="hackathonId" value={event.id} />
                <div className={styles.stack}>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      name="submissionsClosed"
                      defaultChecked={event.submissionsClosed}
                    />
                    <span>Manually close submissions</span>
                  </label>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      name="votingClosed"
                      defaultChecked={event.votingClosed}
                    />
                    <span>Manually close voting</span>
                  </label>
                  <div>
                    <button type="submit" className="button button-secondary">
                      Save controls
                    </button>
                  </div>
                </div>
              </ActionForm>
            </div>
          </section>
        </div>
      </div>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Submission and voting windows</h2>
          <span className={styles.subtle}>{event.timezone}</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Window</th>
                <th>Opens</th>
                <th>Closes</th>
                <th>Now</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Project submissions</strong>
                </td>
                <td>
                  {eventDate(event.submissionOpensAt, event.timezone, true)}
                </td>
                <td>
                  {eventDate(event.submissionClosesAt, event.timezone, true)}
                </td>
                <td>
                  <span
                    className={`${styles.badge} ${submissionsOpen ? styles.active : styles.ended}`}
                  >
                    {submissionsOpen ? "Open" : "Closed"}
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Community voting</strong>
                </td>
                <td>{eventDate(event.votingOpensAt, event.timezone, true)}</td>
                <td>{eventDate(event.votingClosesAt, event.timezone, true)}</td>
                <td>
                  <span
                    className={`${styles.badge} ${votingOpen ? styles.active : styles.ended}`}
                  >
                    {votingOpen ? "Open" : "Closed"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
