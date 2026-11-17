import "server-only";
import type { Viewer } from "../types";
import { assert, normalizeEmail, required, windowIsOpen } from "../validation";
import { serializable, type MutationResult } from "./shared";

export async function toggleVote(
  form: FormData,
  viewer: Viewer,
): Promise<MutationResult> {
  const projectId = required(form, "projectId", "a project");
  const added = await serializable(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      include: {
        hackathon: true,
        team: {
          include: {
            members: { select: { userId: true, normalizedEmail: true } },
          },
        },
      },
    });
    assert(
      project && project.status !== "DRAFT",
      "This project is not available for voting.",
    );
    assert(
      windowIsOpen(project.hackathon, "voting"),
      "Voting is currently closed.",
    );
    const existing = await tx.vote.findUnique({
      where: { userId_projectId: { userId: viewer.id, projectId } },
    });
    if (existing) {
      await tx.vote.delete({ where: { id: existing.id } });
      return false;
    }
    assert(
      project.status === "SUBMITTED",
      "This project is not available for voting.",
    );
    const ownProject =
      project.contributorIds.includes(viewer.id) ||
      project.team.members.some(
        (member) =>
          member.userId === viewer.id ||
          member.normalizedEmail === normalizeEmail(viewer.email),
      );
    assert(!ownProject, "You cannot vote for your own team's project.");
    const count = await tx.vote.count({
      where: { hackathonId: project.hackathonId, userId: viewer.id },
    });
    assert(
      count < project.hackathon.votesPerUser,
      "You have used all your votes for this hackathon. Remove a vote to choose another project.",
    );
    await tx.vote.create({
      data: { hackathonId: project.hackathonId, userId: viewer.id, projectId },
    });
    return true;
  });
  return {
    message: added
      ? "Vote saved."
      : "Vote removed. You can use it on another project.",
  };
}
