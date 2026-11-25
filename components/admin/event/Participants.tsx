import type { Hackathon } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CopyButton } from "@/components/CopyButton";
import { participantInvitePath } from "@/lib/participant-invite";
import { ParticipantEditor } from "../ParticipantEditor";
import { ParticipantImportForm } from "../ImportForms";
import { eventDate } from "../format";
import styles from "../styles";

export async function Participants({ event }: { event: Hackathon }) {
  const participants = await prisma.participant.findMany({
    where: { hackathonId: event.id },
    orderBy: { normalizedEmail: "asc" },
    include: {
      _count: { select: { vouchers: true, invitations: true } },
      team: { select: { name: true } },
      user: { select: { name: true } },
    },
  });
  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <h2>Participant invitation link</h2>
            <p>
              Anyone with this reusable link can sign in with Google and join{" "}
              {event.title} while the hackathon is active.
            </p>
          </div>
          <CopyButton
            value={participantInvitePath(event.id)}
            label="Copy invitation link"
          />
        </div>
        <div className={styles.sectionBody}>
          <a href={participantInvitePath(event.id)}>Open invitation link</a>
        </div>
      </section>
      <div className={styles.split}>
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <h2>Import participants</h2>
              <p>Add the email addresses that can access this event.</p>
            </div>
          </div>
          <div className={styles.sectionBody}>
            <ParticipantImportForm
              hackathonId={event.id}
              existingEmails={participants.map(
                (participant) => participant.normalizedEmail,
              )}
            />
          </div>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <h2>Add a participant</h2>
              <p>Use their Google sign-in email address.</p>
            </div>
          </div>
          <div className={styles.sectionBody}>
            <ParticipantEditor hackathonId={event.id} />
          </div>
        </section>
      </div>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <h2>Participant list</h2>
            <p>
              {participants.length}{" "}
              {participants.length === 1 ? "participant" : "participants"}
            </p>
          </div>
          <a
            className="button button-secondary"
            href={`/api/admin/export?hackathonId=${event.id}&type=participants`}
          >
            Export CSV
          </a>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Participant</th>
                <th>Team</th>
                <th>Access</th>
                <th>Added</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {participants.length ? (
                participants.map((participant) => (
                  <tr key={participant.id}>
                    <td>
                      <strong>
                        {participant.name ||
                          participant.user?.name ||
                          participant.normalizedEmail}
                      </strong>
                      {(participant.user?.name || participant.name) && (
                        <small>{participant.normalizedEmail}</small>
                      )}
                    </td>
                    <td>
                      {participant.team?.name || (
                        <span className={styles.subtle}>No team yet</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${participant.revokedAt ? styles.danger : participant.userId ? styles.active : styles.draft}`}
                      >
                        {participant.revokedAt
                          ? "Revoked"
                          : participant.userId
                            ? "Joined"
                            : "Invited"}
                      </span>
                    </td>
                    <td>{eventDate(participant.createdAt, event.timezone)}</td>
                    <td>
                      <details className={styles.participantEditor}>
                        <summary>Edit participant</summary>
                        <div>
                          <ParticipantEditor
                            key={`${participant.normalizedEmail}-${participant.name}-${!!participant.revokedAt}`}
                            hackathonId={event.id}
                            participant={participant}
                          />
                        </div>
                      </details>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className={styles.tableEmpty}>
                    Share the invitation link or add participants above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
