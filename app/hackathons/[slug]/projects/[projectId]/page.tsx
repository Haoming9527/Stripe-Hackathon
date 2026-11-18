import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, GitFork as Github, Play } from "lucide-react";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/auth";
import { publicProjectSelect, findPublicEvent } from "@/lib/queries";
import { VideoPreview } from "@/components/VideoPreview";
import { CopyButton } from "@/components/CopyButton";
import { ProjectVote } from "@/components/ProjectCard";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string; projectId: string }>;
}) {
  const { slug, projectId } = await params;
  const [event, viewer] = await Promise.all([
    findPublicEvent(slug),
    getViewer(),
  ]);
  if (!event) notFound();
  const project = await prisma.project.findFirst({
    where: { id: projectId, hackathonId: event.id, status: "SUBMITTED" },
    select: publicProjectSelect,
  });
  if (!project) notFound();
  const [votes, own] = await Promise.all([
    viewer
      ? prisma.vote.findMany({
          where: { hackathonId: event.id, userId: viewer.id },
          select: { projectId: true },
        })
      : [],
    viewer
      ? prisma.project.count({
          where: {
            id: project.id,
            OR: [
              { contributorIds: { has: viewer.id } },
              {
                team: {
                  members: {
                    some: {
                      OR: [
                        { userId: viewer.id },
                        { userId: null, normalizedEmail: viewer.email },
                      ],
                    },
                  },
                },
              },
            ],
          },
        })
      : 0,
  ]);
  const now = new Date();
  const open =
    event.status === "ACTIVE" &&
    !event.votingClosed &&
    now >= event.votingOpensAt &&
    now < event.votingClosesAt;
  return (
    <section className="shell page-section project-detail">
      <Link href={`/hackathons/${slug}`} className="back-link">
        <ArrowLeft size={15} /> {event.title}
      </Link>
      <div className="project-detail-heading">
        <div>
          <div className="project-track-list">
            {project.tracks.map(({ track }) => (
              <span className="track-tag" key={track.id}>
                {track.name}
              </span>
            ))}
          </div>
          <h1>{project.name}</h1>
          <p className="lead">Built by {project.team.name}</p>
        </div>
        <CopyButton
          value={`/hackathons/${slug}/projects/${project.id}`}
          share
        />
      </div>
      <VideoPreview
        name={project.name}
        videoUrl={project.videoUrl}
        demoUrl={project.demoUrl}
      />
      <div className="project-detail-body">
        <div>
          <h2>The idea</h2>
          <p className="prose preserve-lines">{project.description}</p>
        </div>
        <aside className="panel stack">
          <h3>Try it for yourself</h3>
          {project.demoUrl && (
            <a
              className="button button-primary"
              href={project.demoUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open demo <ArrowUpRight size={17} />
            </a>
          )}
          <a
            className="button button-secondary"
            href={project.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Play size={16} /> Watch video
          </a>
          <a
            className="button button-secondary"
            href={project.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github size={16} /> View repository
          </a>
          <div className="panel-divider" />
          <ProjectVote
            projectId={project.id}
            slug={slug}
            state={{
              signedIn: !!viewer,
              own: own > 0,
              voted: votes.some((v) => v.projectId === project.id),
              open,
              remaining: Math.max(0, event.votesPerUser - votes.length),
            }}
          />
        </aside>
      </div>
    </section>
  );
}
