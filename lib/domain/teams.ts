import "server-only";
import type { Viewer } from "../types";
import {
  assert,
  field,
  isEmail,
  normalizeEmail,
  required,
} from "../validation";
import {
  eventById,
  participant,
  rosterEditable,
  serializable,
  teamChangesAllowed,
  type MutationResult,
} from "./shared";

const teamPolicy = { status: true, submissionsClosed: true, submissionClosesAt: true, maxTeamSize: true } as const;
const teamWithCapacity = {
  hackathonId: true, ownerId: true, rosterLockedAt: true,
  hackathon: { select: teamPolicy },
  _count: { select: { members: true } },
} as const;

export async function createTeam(
  form: FormData,
  viewer: Viewer,
): Promise<MutationResult> {
  const hackathonId = required(form, "hackathonId", "a hackathon");
  const name = required(form, "name", "a team name", 100);
  await serializable(async (tx) => {
    const event = await eventById(tx, hackathonId, teamPolicy);
    teamChangesAllowed(event);
    const member = await participant(tx, hackathonId, viewer);
    assert(!member.teamId, "You already belong to a team in this hackathon.");
    const team = await tx.team.create({
      data: { hackathonId, name, ownerId: viewer.id },
      select: { id: true },
    });
    await tx.participant.update({
      where: { id: member.id },
      data: { teamId: team.id },
    });
    await tx.teamInvitation.updateMany({
      where: { participantId: member.id, status: "PENDING" },
      data: { status: "DECLINED" },
    });
  });
  return {
    message: "Your team is ready. Invite teammates or start your project.",
  };
}

export async function inviteToTeam(
  form: FormData,
  viewer: Viewer,
): Promise<MutationResult> {
  const teamId = required(form, "teamId", "a team");
  const email = normalizeEmail(
    required(form, "email", "your teammate's email", 254),
  );
  assert(isEmail(email), "Enter a valid email address.");
  await serializable(async (tx) => {
    const team = await tx.team.findUnique({
      where: { id: teamId },
      select: teamWithCapacity,
    });
    assert(
      team && team.ownerId === viewer.id,
      "Only the team owner can invite teammates.",
    );
    await participant(tx, team.hackathonId, viewer);
    teamChangesAllowed(team.hackathon);
    rosterEditable(team);
    assert(
      team._count.members < team.hackathon.maxTeamSize,
      "This team is full.",
    );
    const recipient = await tx.participant.findUnique({
      where: {
        hackathonId_normalizedEmail: {
          hackathonId: team.hackathonId,
          normalizedEmail: email,
        },
      },
      select: { id: true, teamId: true, revokedAt: true },
    });
    assert(
      recipient && !recipient.revokedAt,
      "That email is not registered for this hackathon. Ask an organizer to add it.",
    );
    assert(!recipient.teamId, "That participant already belongs to a team.");
    const previous = await tx.teamInvitation.findUnique({
      where: { teamId_participantId: { teamId, participantId: recipient.id } },
      select: { status: true },
    });
    assert(
      previous?.status !== "PENDING",
      "This participant already has a pending invitation in their portal.",
    );
    await tx.teamInvitation.upsert({
      where: { teamId_participantId: { teamId, participantId: recipient.id } },
      create: { teamId, participantId: recipient.id },
      update: { status: "PENDING", updatedAt: new Date() },
    });
  });
  return {
    message:
      "Invitation saved in the portal. Your teammate can accept it from the Team tab.",
  };
}

export async function respondToInvitation(
  form: FormData,
  viewer: Viewer,
  cancel = false,
): Promise<MutationResult> {
  const id = required(form, "invitationId", "an invitation");
  const response = cancel ? "cancel" : field(form, "response", 20);
  assert(
    cancel || response === "accept" || response === "decline",
    "Choose accept or decline.",
  );
  await serializable(async (tx) => {
    const invitation = await tx.teamInvitation.findUnique({
      where: { id },
      select: {
        status: true, participantId: true, teamId: true,
        team: { select: {
          ...teamWithCapacity,
          hackathon: response === "accept" && teamWithCapacity.hackathon,
          _count: response === "accept" && teamWithCapacity._count,
        } },
      },
    });
    assert(
      invitation && invitation.status === "PENDING",
      "This invitation is no longer pending.",
    );
    if (cancel) {
      assert(
        invitation.team.ownerId === viewer.id,
        "Only the team owner can cancel this invitation.",
      );
      await participant(tx, invitation.team.hackathonId, viewer);
      await tx.teamInvitation.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      return;
    }
    const member = await participant(tx, invitation.team.hackathonId, viewer);
    assert(
      member.id === invitation.participantId,
      "This invitation belongs to another participant.",
    );
    if (response === "accept") {
      teamChangesAllowed(invitation.team.hackathon);
      rosterEditable(invitation.team);
      assert(
        !member.teamId,
        "Leave your current team before accepting another invitation.",
      );
      assert(
        invitation.team._count.members < invitation.team.hackathon.maxTeamSize,
        "That team is now full.",
      );
      await tx.participant.update({
        where: { id: member.id },
        data: { teamId: invitation.teamId },
      });
      await tx.teamInvitation.updateMany({
        where: { participantId: member.id, status: "PENDING", id: { not: id } },
        data: { status: "DECLINED" },
      });
    }
    await tx.teamInvitation.update({
      where: { id },
      data: { status: response === "accept" ? "ACCEPTED" : "DECLINED" },
    });
  });
  return {
    message:
      response === "accept"
        ? "You joined the team."
        : response === "cancel"
          ? "Invitation cancelled."
          : "Invitation declined.",
  };
}

export async function removeFromTeam(
  form: FormData,
  viewer: Viewer,
  leave: boolean,
): Promise<MutationResult> {
  const teamId = required(form, "teamId", "a team");
  await serializable(async (tx) => {
    const team = await tx.team.findUnique({
      where: { id: teamId },
      select: { ...teamWithCapacity, _count: leave && teamWithCapacity._count },
    });
    assert(team, "This team could not be found.");
    teamChangesAllowed(team.hackathon);
    rosterEditable(team);
    const caller = await participant(tx, team.hackathonId, viewer);
    assert(caller.teamId === teamId, "You do not belong to this team.");
    const participantId = leave
      ? caller.id
      : required(form, "participantId", "a teammate");
    if (!leave)
      assert(
        team.ownerId === viewer.id && participantId !== caller.id,
        "Only the team owner can remove another teammate.",
      );
    if (team.ownerId === viewer.id && leave) {
      assert(
        team._count.members === 1,
        "Remove the other members before leaving your team.",
      );
      await tx.team.delete({ where: { id: teamId } });
    } else {
      const changed = await tx.participant.updateMany({
        where: { id: participantId, teamId },
        data: { teamId: null },
      });
      assert(changed.count === 1, "That participant does not belong to this team.");
    }
  });
  return { message: leave ? "You left the team." : "Teammate removed." };
}
