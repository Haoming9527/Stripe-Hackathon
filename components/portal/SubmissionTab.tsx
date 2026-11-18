import "server-only";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Code2 } from "lucide-react";
import { eventDate } from "@/lib/presentation";
import { ActionForm } from "@/components/ActionForm";
import type { PortalData } from "./data";

export function SubmissionTab({
  event,
  team,
  submissionsOpen,
  now,
}: Pick<PortalData, "event" | "team" | "submissionsOpen" | "now">) {
  const slug = event.slug;
  const base = `/hackathons/${slug}/portal`;
  const project = team?.project;
  const expectedUpdatedAt = project?.updatedAt.toISOString() ?? "";
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Project submission</h2>
          <p className="muted">
            Save a private draft or publish your team’s project to the gallery.
          </p>
        </div>
        {project && (
          <span
            className={`badge ${project.status === "SUBMITTED" ? "badge-active" : "badge-draft"}`}
          >
            {project.status === "SUBMITTED"
              ? "Published in gallery"
              : project.status === "HIDDEN"
                ? "Hidden by organizer"
                : "Draft saved"}
          </span>
        )}
      </div>
      {!team ? (
        <div className="empty-state">
          <Code2 size={32} />
          <h3>Join or create a team</h3>
          <p>Create a solo team or accept an invitation before submitting.</p>
          <Link href={`${base}?tab=team`} className="button button-primary">
            Open your team <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="submission-layout">
          <div className="panel">
            <ActionForm intent="project.save" className="stack">
              <input type="hidden" name="hackathonId" value={event.id} />
              <input type="hidden" name="teamId" value={team.id} />
              <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />
              <fieldset
                key={`${team.id}:${expectedUpdatedAt}`}
                disabled={!submissionsOpen}
                className="form-fieldset stack"
              >
                <label className="field">
                  Project name <span className="required">*</span>
                  <input
                    name="name"
                    defaultValue={project?.name}
                    maxLength={150}
                    required
                  />
                </label>
                <label className="field">
                  Description · what does it do?{" "}
                  <span className="required">*</span>
                  <textarea
                    name="description"
                    rows={7}
                    maxLength={10000}
                    defaultValue={project?.description}
                    placeholder="What problem are you solving? How does your project work? What makes it different?"
                  />
                </label>
                {event.tracks.length > 0 && (
                  <fieldset className="track-picker">
                    <legend>
                      Tracks <span className="required">*</span>
                    </legend>
                    <p className="field-hint">
                      Select 1 to {event.maxTrackSelections} tracks.
                    </p>
                    {event.tracks.map((track) => (
                      <label className="check-option" key={track.id}>
                        <input
                          type="checkbox"
                          name="trackIds"
                          value={track.id}
                          defaultChecked={project?.tracks.some(
                            (t) => t.trackId === track.id,
                          )}
                        />
                        <span>
                          <strong>{track.name}</strong>
                          {track.description && (
                            <small>{track.description}</small>
                          )}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}
                <label className="field">
                  Demo URL <span className="optional">Optional</span>
                  <input
                    type="url"
                    name="demoUrl"
                    defaultValue={project?.demoUrl || ""}
                    placeholder="https://your-project.com"
                  />
                </label>
                <label className="field">
                  Video URL <span className="required">*</span>
                  <input
                    type="url"
                    name="videoUrl"
                    defaultValue={project?.videoUrl || ""}
                    placeholder="https://youtube.com/watch?v=…"
                  />
                  <span className="field-hint">
                    YouTube videos get a playable preview in the gallery.
                  </span>
                </label>
                <label className="field">
                  GitHub repository URL <span className="required">*</span>
                  <input
                    type="url"
                    name="githubUrl"
                    defaultValue={project?.githubUrl || ""}
                    placeholder="https://github.com/your-team/your-project"
                  />
                </label>
                <label className="consent-option">
                  <input
                    type="checkbox"
                    name="consent"
                    defaultChecked={!!project?.consentAt}
                  />
                  <span>
                    I agree to publish this project, demo, video and GitHub
                    repository in the public gallery automatically when I
                    submit.
                  </span>
                </label>
                <div className="form-actions">
                  <button
                    type="submit"
                    name="publish"
                    value="false"
                    className="button button-secondary"
                  >
                    {project?.publishedAt ? "Save changes" : "Save draft"}
                  </button>
                  <button
                    type="submit"
                    name="publish"
                    value="true"
                    className="button button-primary"
                  >
                    {project?.publishedAt
                      ? "Update project"
                      : "Submit and publish"}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </fieldset>
              {!submissionsOpen && (
                <div className="notice">
                  {now < event.submissionOpensAt && event.status === "ACTIVE"
                    ? `Submissions open ${eventDate(event.submissionOpensAt, event.timezone, true)}.`
                    : "Submissions are closed. Your project is now read-only."}
                </div>
              )}
            </ActionForm>
          </div>
          <aside className="submission-aside">
            <div className="panel stack">
              <h3>Before you submit</h3>
              <ul className="checklist">
                <li>
                  <Check size={15} /> One project for {team.name}
                </li>
                <li>
                  <Check size={15} /> Video and GitHub are required
                </li>
                <li>
                  <Check size={15} /> Publishing makes your project public
                </li>
                <li>
                  <Check size={15} /> Team roster locks on submission
                </li>
              </ul>
              <p className="field-hint">
                Deadline:{" "}
                {eventDate(event.submissionClosesAt, event.timezone, true)}
              </p>
              {project?.status === "SUBMITTED" && (
                <Link
                  href={`/hackathons/${slug}/projects/${project.id}`}
                  className="button button-secondary"
                >
                  View your project <ArrowUpRight size={16} />
                </Link>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
