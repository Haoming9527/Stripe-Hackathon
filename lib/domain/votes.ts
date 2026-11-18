import "server-only";
import type { Viewer } from "../types";
import { assert, normalizeEmail, required, windowIsOpen } from "../validation";
import { serializable, type MutationResult } from "./shared";

export async function setVote(
  form: FormData,
  viewer: Viewer,
  withdraw: boolean,
): Promise<MutationResult> {
  const projectId = required(form, "projectId", "a project");
  await serializable(async (tx) => {
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
    if (withdraw) {
      await tx.vote.deleteMany({ where: { userId: viewer.id, projectId } });
      return;
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
          (member.userId === null &&
            member.normalizedEmail === normalizeEmail(viewer.email)),
      );
    assert(!ownProject, "You cannot vote for your own team's project.");
    const existing = await tx.vote.findUnique({
      where: { userId_projectId: { userId: viewer.id, projectId } },
    });
    if (existing) return;
    const count = await tx.vote.count({
      where: { hackathonId: project.hackathonId, userId: viewer.id },
    });
    assert(
      count < project.hackathon.votesPerUser,
      "You have used all your votes for this hackathon. Remove a vote to choose another project.",
    );
    await tx.vote.createMany({
      data: { hackathonId: project.hackathonId, userId: viewer.id, projectId },
      skipDuplicates: true,
    });
  });
  return {
    message: withdraw
      ? "Vote removed. You can use it on another project."
      : "Vote saved.",
  };
}
