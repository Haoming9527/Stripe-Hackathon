import "server-only";
import type { Viewer } from "../types";
import {
  assert,
  field,
  flag,
  githubUrl,
  required,
  safeUrl,
  windowIsOpen,
} from "../validation";
import {
  admin,
  eventById,
  participant,
  serializable,
  type MutationResult,
} from "./shared";

export async function saveProject(
  form: FormData,
  viewer: Viewer,
): Promise<MutationResult> {
  const hackathonId = required(form, "hackathonId", "a hackathon");
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
    const event = await eventById(tx, hackathonId);
    assert(
      windowIsOpen(event, "submission"),
      "Submissions are currently closed.",
    );
    const member = await participant(tx, hackathonId, viewer);
    assert(
      member.teamId,
      "Create or join a team before starting a project. Solo teams are welcome.",
    );
    const team = await tx.team.findUnique({
      where: { id: member.teamId },
      include: { project: true, members: true },
    });
    assert(
      team && team.hackathonId === hackathonId,
      "This team could not be found.",
    );
    assert(
      team.members.length <= event.maxTeamSize,
      "Your team exceeds the event's size limit.",
    );
    const isPublic =
      publish ||
      team.project?.status === "SUBMITTED" ||
      team.project?.status === "HIDDEN";
    let videoUrl = video;
    let repositoryUrl = github;
    if (isPublic) {
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
    const tracks = await tx.track.findMany({
      where: { hackathonId },
      select: { id: true },
    });
    assert(
      trackIds.every((id) => tracks.some((track) => track.id === id)),
      "A selected track does not belong to this hackathon.",
    );
    assert(
      trackIds.length <= event.maxTrackSelections,
      `Choose at most ${event.maxTrackSelections} tracks.`,
    );
    if (isPublic && tracks.length)
      assert(trackIds.length >= 1, "Choose at least one track.");
    const firstPublish = isPublic && !team.project?.publishedAt;
    const now = new Date();
    const data = {
      name,
      description,
      demoUrl,
      videoUrl,
      githubUrl: repositoryUrl,
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
            contributorIds: team.members
              .map((item) => item.userId)
              .filter((value): value is string => Boolean(value)),
          }
        : {}),
    };
    const project = await tx.project.upsert({
      where: { teamId: team.id },
      create: { ...data, hackathonId, teamId: team.id },
      update: data,
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
      ? "Your project is published in the gallery. Your team roster is now locked."
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
    const project = await tx.project.findUnique({ where: { id } });
    assert(
      project?.publishedAt && project.consentAt,
      "Only projects already submitted by participants can be moderated.",
    );
    await tx.project.update({ where: { id }, data: { status } });
  });
  return {
    message:
      status === "HIDDEN"
        ? "Project hidden from the gallery."
        : "Project restored to the gallery.",
  };
}
