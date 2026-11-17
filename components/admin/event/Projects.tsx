import Link from "next/link";
import type { Hackathon } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ActionForm } from "@/components/ActionForm";
import { eventDate } from "../format";
import styles from "../styles";
import { Status } from "./Status";

export async function Projects({ event }: { event: Hackathon }) {
  const projects = await prisma.project.findMany({
    where: { hackathonId: event.id },
    orderBy: [{ votes: { _count: "desc" } }, { createdAt: "asc" }],
    include: {
      team: { select: { name: true } },
      tracks: { include: { track: { select: { name: true } } } },
      _count: { select: { votes: true } },
    },
  });
  return (
    <>
      <div className={styles.callout} style={{ marginBottom: 22 }}>
        <strong>Voting results are private.</strong> Only organizers can see
        these totals. Participants and gallery visitors see their own selections
        and remaining allowance.
      </div>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <h2>Projects and voting results</h2>
            <p>
              {
                projects.filter((project) => project.status === "SUBMITTED")
                  .length
              }{" "}
              published ·{" "}
              {projects.filter((project) => project.status === "DRAFT").length}{" "}
              drafts ·{" "}
              {projects.reduce(
                (total, project) => total + project._count.votes,
                0,
              )}{" "}
              votes
            </p>
          </div>
          <a
            href={`/api/admin/export?hackathonId=${event.id}&type=votes`}
            className="button button-secondary"
          >
            Export results
          </a>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Project</th>
                <th>Status</th>
                <th>Votes</th>
                <th>Published</th>
                <th>Gallery visibility</th>
              </tr>
            </thead>
            <tbody>
              {projects.length ? (
                projects.map((project) => (
                  <tr key={project.id}>
                    <td>
                      <strong>
                        {project.status === "SUBMITTED" ? (
                          <Link
                            className={styles.textLink}
                            href={`/hackathons/${event.slug}/projects/${project.id}`}
                          >
                            {project.name}
                          </Link>
                        ) : (
                          project.name
                        )}
                      </strong>
                      <small>{project.team.name}</small>
                      {project.tracks.length > 0 && (
                        <small>
                          {project.tracks
                            .map(({ track }) => track.name)
                            .join(", ")}
                        </small>
                      )}
                      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                        {project.githubUrl && (
                          <a
                            className={styles.textLink}
                            href={project.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            GitHub ↗
                          </a>
                        )}
                        {project.videoUrl && (
                          <a
                            className={styles.textLink}
                            href={project.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Video ↗
                          </a>
                        )}
                      </div>
                    </td>
                    <td>
                      <Status status={project.status} />
                    </td>
                    <td>
                      <span className={styles.voteTotal}>
                        {project._count.votes}
                      </span>
                    </td>
                    <td>
                      {eventDate(project.publishedAt, event.timezone, true)}
                    </td>
                    <td>
                      {project.status === "DRAFT" ? (
                        <span className={styles.subtle}>
                          Awaiting submission
                        </span>
                      ) : (
                        <ActionForm intent="project.moderate">
                          <input
                            type="hidden"
                            name="projectId"
                            value={project.id}
                          />
                          <input
                            type="hidden"
                            name="status"
                            value={
                              project.status === "HIDDEN"
                                ? "SUBMITTED"
                                : "HIDDEN"
                            }
                          />
                          <button
                            className={`button ${project.status === "HIDDEN" ? "button-secondary" : "button-danger"}`}
                            type="submit"
                          >
                            {project.status === "HIDDEN"
                              ? "Restore to gallery"
                              : "Hide project"}
                          </button>
                        </ActionForm>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className={styles.tableEmpty}>
                    Projects appear here as teams start drafting. Published
                    submissions go straight to the public gallery.
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
