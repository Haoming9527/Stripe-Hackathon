import type { Hackathon } from "@prisma/client";
import { teamSizeLabel } from "@/lib/team-size";
import { prisma } from "@/lib/db";
import styles from "../styles";
import { Status } from "./Status";

export async function Teams({ event }: { event: Pick<Hackathon, "id" | "minTeamSize" | "maxTeamSize"> }) {
  const teams = await prisma.team.findMany({
    where: { hackathonId: event.id },
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { name: true, email: true } },
      members: { select: { normalizedEmail: true, name: true } },
      project: { select: { id: true, name: true, status: true } },
      invitations: {
        where: { status: "PENDING" },
        select: { id: true },
      },
    },
  });
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <div>
          <h2>Teams taking shape</h2>
          <p>
            {teamSizeLabel(event.minTeamSize, event.maxTeamSize)} per team at submission. Rosters lock when a
            project is first published.
          </p>
        </div>
        <span className={styles.badge}>{teams.length} teams</span>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Team</th>
              <th>Members</th>
              <th>Project</th>
              <th>Roster</th>
            </tr>
          </thead>
          <tbody>
            {teams.length ? (
              teams.map((team) => (
                <tr key={team.id}>
                  <td>
                    <strong>{team.name}</strong>
                    <small>Owner: {team.owner.name || team.owner.email}</small>
                    {team.invitations.length > 0 && (
                      <small>
                        {team.invitations.length} pending invitations
                      </small>
                    )}
                  </td>
                  <td>
                    <strong>
                      {team.members.length} / {event.maxTeamSize}
                    </strong>
                    {team.members.map((member) => (
                      <small key={member.normalizedEmail}>
                        {member.normalizedEmail}
                      </small>
                    ))}
                  </td>
                  <td>
                    {team.project ? (
                      <>
                        <strong>{team.project.name}</strong>
                        <Status status={team.project.status} />
                      </>
                    ) : (
                      <span className={styles.subtle}>No project yet</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${team.rosterLockedAt ? styles.ended : styles.active}`}
                    >
                      {team.rosterLockedAt ? "Locked" : "Open"}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className={styles.tableEmpty}>
                  Teams will appear here when participants create them in their
                  portal.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
