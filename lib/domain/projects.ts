import "server-only";
import type { Viewer } from "../types";
import {
  assert,
  field,
  flag,
  githubUrl,
  required,
  safeUrl,
  submissionIsOpen,
} from "../validation";
import {
  admin,
  eventById,
  participant,
  serializable,
  type MutationResult,
} from "./shared";

// updatedAt is the editor's version. Advance it even if two writes share a millisecond.
function nextProjectTimestamp(previous?: Date) {
  return new Date(Math.max(Date.now(), (previous?.getTime() ?? 0) + 1));
}

export async function saveProject(
  form: FormData,
  viewer: Viewer,
): Promise<MutationResult> {
  const hackathonId = required(form, "hackathonId", "a hackathon");
  const teamId = required(form, "teamId", "the team");
  const expectedUpdatedAt = field(form, "expectedUpdatedAt", 40);
  const name = required(form, "name", "a project name", 150);
  const description = field(form, "description", 20_000);
  const video = field(form, "videoUrl", 2048);
  const github = field(form, "githubUrl", 2048);
  const demoUrl = safeUrl(field(form, "demoUrl", 2048), "demo URL", true);
  const trackIds = [
    ...new Set(form.getAll("trackIds").map((value) => String(value))),
  ];
  assert(trackIds.length <= 100, "Too many tracks were selected.");
  const publish = flag(form, "publish");
  const saved = await serializable(async (tx) => {
    const event = await eventById(tx, hackathonId, {
      status: true, submissionsClosed: true, submissionOpensAt: true, submissionClosesAt: true,
      minTeamSize: true, maxTeamSize: true, maxTrackSelections: true,
    });
    assert(
      submissionIsOpen(event),
      "Submissions are currently closed.",
    );
    const member = await participant(tx, hackathonId, viewer);
    assert(
      member.teamId,
      "Create or join a team before starting a project.",
    );
    const team = await tx.team.findUnique({
      where: { id: member.teamId },
      select: {
        id: true, hackathonId: true,
        _count: { select: { members: true } },
        project: { select: { updatedAt: true, publishedAt: true, status: true, consentAt: true } },
      },
    });
    assert(
      team && team.hackathonId === hackathonId,
      "This team could not be found.",
    );
    assert(
      team.id === teamId &&
        (team.project?.updatedAt.toISOString() ?? "") === expectedUpdatedAt,
      "Your team or project changed since you opened this form. Copy your edits and reload the page to review the latest version.",
    );
    assert(
      team._count.members <= event.maxTeamSize,
      "Your team exceeds the event's size limit.",
    );
    const isPublic =
      publish ||
      team.project?.status === "SUBMITTED" ||
      team.project?.status === "HIDDEN";
    let videoUrl = video;
    let repositoryUrl = github;
    if (isPublic) {
      assert(team._count.members >= (event.minTeamSize ?? 1),
        `Your team needs at least ${event.minTeamSize} members to publish.`);
      assert(description, "Describe what your project does.");
      videoUrl = safeUrl(video, "video URL")!;
      repositoryUrl = githubUrl(github);
      if (!team.project?.consentAt)
        assert(
          flag(form, "consent"),
          "Agree to publish your project and links before submitting.",
        );
    } else {
      if (video) videoUrl = safeUrl(video, "video URL")!;
      if (github) repositoryUrl = githubUrl(github);
    }
    if (trackIds.length) {
      const selectedTracks = await tx.track.count({ where: { hackathonId, id: { in: trackIds } } });
      assert(selectedTracks === trackIds.length, "A selected track does not belong to this hackathon.");
    } else if (isPublic) {
      const track = await tx.track.findFirst({ where: { hackathonId }, select: { id: true } });
      assert(!track, "Choose at least one track.");
    }
    assert(
      trackIds.length <= event.maxTrackSelections,
      `Choose at most ${event.maxTrackSelections} tracks.`,
    );
    const firstPublish = isPublic && !team.project?.publishedAt;
    const contributors = firstPublish
      ? await tx.participant.findMany({ where: { teamId, userId: { not: null } }, select: { userId: true } })
      : [];
    const now = nextProjectTimestamp(team.project?.updatedAt);
    const data = {
      name,
      description,
      demoUrl,
      videoUrl,
      githubUrl: repositoryUrl,
      updatedAt: now,
      status:
        team.project?.status === "HIDDEN"
          ? ("HIDDEN" as const)
          : isPublic
            ? ("SUBMITTED" as const)
            : ("DRAFT" as const),
      ...(firstPublish
        ? {
            publishedAt: now,
            consentAt: now,
            consentUserId: viewer.id,
            contributorIds: contributors
              .map((item) => item.userId)
              .filter((value): value is string => Boolean(value)),
          }
        : {}),
    };
    const project = await tx.project.upsert({
      where: { teamId: team.id },
      create: { ...data, hackathonId, teamId: team.id },
      update: data,
      select: { id: true, status: true },
    });
    await tx.projectTrack.deleteMany({ where: { projectId: project.id } });
    if (trackIds.length)
      await tx.projectTrack.createMany({
        data: trackIds.map((trackId) => ({ projectId: project.id, trackId })),
      });
    if (firstPublish) {
      await tx.team.update({
        where: { id: team.id },
        data: { rosterLockedAt: now },
      });
      await tx.teamInvitation.updateMany({
        where: { teamId: team.id, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
    }
    return { project, firstPublish };
  });
  return {
    message: saved.firstPublish
      ? "Your project is published in the gallery."
      : saved.project.status === "DRAFT"
        ? "Draft saved."
        : "Project updated.",
  };
}

export async function moderateProject(
  form: FormData,
  viewer: Viewer,
): Promise<MutationResult> {
  admin(viewer);
  const id = required(form, "projectId", "a project");
  const status = field(form, "status", 20);
  assert(
    status === "SUBMITTED" || status === "HIDDEN",
    "Choose whether to hide or restore the project.",
  );
  await serializable(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id }, select: { publishedAt: true, consentAt: true, updatedAt: true },
    });
    assert(
      project?.publishedAt && project.consentAt,
      "Only projects already submitted by participants can be moderated.",
    );
    await tx.project.update({
      where: { id },
      data: { status, updatedAt: nextProjectTimestamp(project.updatedAt) },
      select: { id: true },
    });
  });
  return {
    message:
      status === "HIDDEN"
        ? "Project hidden from the gallery."
        : "Project restored to the gallery.",
  };
}
