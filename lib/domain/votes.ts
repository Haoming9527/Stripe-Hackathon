import "server-only";
import type { Viewer } from "../types";
import { votingMemberFilter } from "../queries";
import { assert, required, votingIsOpen } from "../validation";
import { serializable, type MutationResult } from "./shared";

export async function setVote(
  form: FormData,
  viewer: Viewer,
  withdraw: boolean,
): Promise<MutationResult> {
  const projectId = required(form, "projectId", "a project");
  await serializable(async (tx) => {
    const viewerVotes = { select: { votes: { where: { userId: viewer.id } } } };
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: {
        status: true,
        hackathonId: true,
        teamId: !withdraw,
        contributorIds: !withdraw,
        _count: withdraw ? false : viewerVotes,
        hackathon: {
          select: {
            status: true,
            votingClosed: true,
            votingOpensAt: true,
            votingClosesAt: true,
            votesPerUser: !withdraw,
            _count: withdraw ? false : viewerVotes,
          },
        },
      },
    });
    assert(
      project && project.status !== "DRAFT",
      "This project is not available for voting.",
    );
    assert(
      votingIsOpen(project.hackathon),
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
      await tx.participant.findFirst({
        where: { teamId: project.teamId, ...votingMemberFilter(viewer) },
        select: { id: true },
      });
    assert(!ownProject, "You cannot vote for your own team's project.");
    if (project._count.votes > 0) return;
    assert(
      project.hackathon._count.votes < project.hackathon.votesPerUser,
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
