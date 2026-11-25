import { ActionForm } from "@/components/ActionForm";
import styles from "./styles";

export function ParticipantEditor({ hackathonId, participant }: {
  hackathonId: string;
  participant?: { id: string; name: string | null; normalizedEmail: string; userId: string | null; teamId: string | null; revokedAt: Date | null; _count: { vouchers: number; invitations: number } };
}) {
  const emailLocked = !!participant && !!(participant.userId || participant.teamId || participant._count.vouchers || participant._count.invitations);
  return (
    <div className={styles.fields}>
      <ActionForm intent={participant ? "participants.update" : "participants.create"} className="stack">
        <input type="hidden" name="hackathonId" value={hackathonId} />
        {participant && <input type="hidden" name="participantId" value={participant.id} />}
        {participant && <input type="hidden" name="original" value={JSON.stringify({ name: participant.name ?? "", email: participant.normalizedEmail })} />}
        <label className={styles.field}>Name (optional)
          <input name="name" defaultValue={participant?.name || ""} maxLength={120} autoComplete="off" />
        </label>
        <label className={styles.field}>Email address
          <input name="email" type="email" required defaultValue={participant?.normalizedEmail || ""} readOnly={emailLocked} maxLength={320} autoComplete="off" />
          {emailLocked && <small>Email is fixed after sign-in, team activity, or credit allocation.</small>}
        </label>
        <button className="button button-primary" type="submit">{participant ? "Save participant" : "Add participant"}</button>
      </ActionForm>
      {participant && (
        <ActionForm intent={participant.revokedAt ? "participants.restore" : "participants.remove"} className="stack">
          <input type="hidden" name="hackathonId" value={hackathonId} />
          <input type="hidden" name="participantId" value={participant.id} />
          <p className={styles.subtle}>{participant.revokedAt ? "Restore access to this hackathon." : "Removing access keeps team, project, and credit history. Access can be restored later."}</p>
          {!participant.revokedAt && <label className={styles.check}><input type="checkbox" required /><span>Remove this participant’s event access</span></label>}
          <button type="submit" className="button button-secondary">{participant.revokedAt ? "Restore participant" : "Remove participant"}</button>
        </ActionForm>
      )}
    </div>
  );
}
