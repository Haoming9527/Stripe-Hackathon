import "@/app/styles/gallery.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
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
    <section className="shell project-profile">
      <Link href={`/hackathons/${slug}`} className="back-link">
        <ArrowLeft size={15} /> {event.title}
      </Link>
      <div className="project-profile-heading">
        <div>
          <h1>{project.name}</h1>
          <p className="lead">Built by {project.team.name}</p>
          {project.tracks.length > 0 && (
            <ul className="project-tracks" aria-label="Tracks">
              {project.tracks.map(({ track }) => (
                <li key={track.id}>{track.name}</li>
              ))}
            </ul>
          )}
        </div>
        <CopyButton
          value={`/hackathons/${slug}/projects/${project.id}`}
          share
        />
      </div>
      <div className="project-profile-body">
        <div>
          <h2>About the project</h2>
          <p className="prose preserve-lines">{project.description}</p>
          <VideoPreview
            name={project.name}
            videoUrl={project.videoUrl}
            demoUrl={project.demoUrl}
          />
        </div>
        <aside className="project-resources">
          <h2>Project links</h2>
          {project.demoUrl && (
            <a href={project.demoUrl} target="_blank" rel="noopener noreferrer">
              Open demo <ArrowUpRight size={17} />
            </a>
          )}
          <a href={project.videoUrl} target="_blank" rel="noopener noreferrer">
            Watch video <ArrowUpRight size={17} />
          </a>
          <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
            View repository <ArrowUpRight size={17} />
          </a>
          <div className="project-resource-vote">
            <ProjectVote
              projectId={project.id}
              callbackUrl={`/hackathons/${slug}`}
              state={{
                signedIn: !!viewer,
                own: own > 0,
                voted: votes.some((v) => v.projectId === project.id),
                open,
                remaining: Math.max(0, event.votesPerUser - votes.length),
              }}
            />
          </div>
        </aside>
      </div>
    </section>
  );
}
