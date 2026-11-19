import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Heart,
  LockKeyhole,
} from "lucide-react";
import { VideoPreview } from "@/components/VideoPreview";
import { CopyButton } from "@/components/CopyButton";
import { ActionForm } from "@/components/ActionForm";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { missingAuthSettings } from "@/lib/auth";
import type { PublicProject } from "@/lib/queries";
import { safeExternalUrl } from "@/lib/presentation";

export type ProjectVoteState = {
  signedIn: boolean;
  own: boolean;
  voted: boolean;
  open: boolean;
  remaining: number;
};

export function ProjectVote({
  projectId,
  callbackUrl,
  state,
}: {
  projectId: string;
  callbackUrl?: string;
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
      <GoogleSignInButton
        callbackUrl={callbackUrl}
        disabled={missingAuthSettings().length > 0}
        className="button button-small button-secondary"
      >
        <Heart size={15} /> Sign in to vote
      </GoogleSignInButton>
    );
  return (
    <ActionForm
      intent={state.voted ? "vote.withdraw" : "vote.add"}
      className="vote-form"
    >
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
  const demo = safeExternalUrl(project.demoUrl) ?? safeExternalUrl(project.videoUrl);
  return (
    <article className="gallery-card project-card">
      <VideoPreview
        name={project.name}
        videoUrl={project.videoUrl}
        demoUrl={project.demoUrl}
      />
      <div className="project-identity">
        <h3>
          <Link href={url}>{project.name}</Link>
        </h3>
        <p>By {project.team.name}</p>
        {project.tracks.length > 0 && (
          <ul className="project-tracks" aria-label="Tracks">
            {project.tracks.map(({ track }) => (
              <li key={track.id}>{track.name}</li>
            ))}
          </ul>
        )}
      </div>
      <p className="entry-description">{project.description}</p>
      <div className="project-card-footer">
        <div className="project-actions">
          {demo && (
            <a href={demo} target="_blank" rel="noopener noreferrer">
              Demo link <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          )}
          <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
            GitHub <ArrowUpRight size={14} />
          </a>
          <CopyButton value={url} share />
        </div>
        <ProjectVote projectId={project.id} state={vote} />
      </div>
    </article>
  );
}
