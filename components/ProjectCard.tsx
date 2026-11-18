import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  GitFork as Github,
  Heart,
  LockKeyhole,
} from "lucide-react";
import { VideoPreview } from "@/components/VideoPreview";
import { CopyButton } from "@/components/CopyButton";
import { ActionForm } from "@/components/ActionForm";
import type { PublicProject } from "@/lib/queries";

export type ProjectVoteState = {
  signedIn: boolean;
  own: boolean;
  voted: boolean;
  open: boolean;
  remaining: number;
};

export function ProjectVote({
  projectId,
  slug,
  state,
}: {
  projectId: string;
  slug: string;
  state: ProjectVoteState;
}) {
  if (state.own)
    return (
      <span className="vote-label">
        <LockKeyhole size={14} /> Your team’s project
      </span>
    );
  if (!state.open)
    return (
      <span className="vote-label">
        {state.voted ? (
          <>
            <Check size={14} /> You voted
          </>
        ) : (
          "Voting closed"
        )}
      </span>
    );
  if (!state.signedIn)
    return (
      <Link
        href={`/login?callbackUrl=${encodeURIComponent(`/hackathons/${slug}`)}`}
        className="button button-small button-secondary"
      >
        <Heart size={15} /> Sign in to vote
      </Link>
    );
  return (
    <ActionForm intent={state.voted ? "vote.withdraw" : "vote.add"} className="vote-form">
      <input type="hidden" name="projectId" value={projectId} />
      <button
        type="submit"
        className={`button button-small ${state.voted ? "button-voted" : "button-secondary"}`}
        disabled={!state.voted && state.remaining <= 0}
        aria-pressed={state.voted}
      >
        {state.voted ? <Check size={15} /> : <Heart size={15} />}
        {state.voted
          ? "Voted · undo"
          : state.remaining <= 0
            ? "All votes used"
            : "Vote for project"}
      </button>
    </ActionForm>
  );
}

export function ProjectCard({
  project,
  slug,
  vote,
}: {
  project: PublicProject;
  slug: string;
  vote: ProjectVoteState;
}) {
  const url = `/hackathons/${slug}/projects/${project.id}`;
  return (
    <article className="project-card">
      <VideoPreview
        name={project.name}
        videoUrl={project.videoUrl}
        demoUrl={project.demoUrl}
      />
      <div className="project-card-body">
        <div className="project-track-list">
          {project.tracks.map(({ track }) => (
            <span className="track-tag" key={track.id}>
              {track.name}
            </span>
          ))}
        </div>
        <h3>
          <Link href={url}>{project.name}</Link>
        </h3>
        <p className="project-team">by {project.team.name}</p>
        <p className="project-description">{project.description}</p>
        <div className="project-links">
          {project.demoUrl && (
            <a href={project.demoUrl} target="_blank" rel="noopener noreferrer">
              Demo <ArrowUpRight size={14} />
            </a>
          )}
          <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
            <Github size={14} /> GitHub
          </a>
          <Link href={url}>
            Details <ArrowUpRight size={14} />
          </Link>
          <CopyButton value={url} share />
        </div>
        <div className="project-card-vote">
          <ProjectVote projectId={project.id} slug={slug} state={vote} />
        </div>
      </div>
    </article>
  );
}
