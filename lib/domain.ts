import "server-only";
import type { Viewer } from "./types";
import { assert, DomainError } from "./validation";
import type { MutationResult } from "./domain/shared";
import { changeEvent, deleteEvent, saveEvent } from "./domain/events";
import { importParticipants, manageParticipant } from "./domain/participants";
import {
  createTeam,
  inviteToTeam,
  removeFromTeam,
  respondToInvitation,
} from "./domain/teams";
import { moderateProject, saveProject } from "./domain/projects";
import { setVote } from "./domain/votes";
import {
  assignCredits,
  claimCredit,
  importCredits,
  saveCreditOffer,
} from "./domain/credits";

export { serializable, type MutationResult } from "./domain/shared";

/** Public mutation interface: authenticated viewer in, domain result or DomainError out.
 * Feature modules keep transaction rules and authorization local to each operation.
 */
export async function performMutation(
  intent: string,
  form: FormData,
  viewer: Viewer,
): Promise<MutationResult> {
  assert(viewer.id && viewer.email, "Sign in to continue.");
  switch (intent) {
    case "event.save":
      return saveEvent(form, viewer);
    case "event.delete":
      return deleteEvent(form, viewer);
    case "event.status":
      return changeEvent(form, viewer, false);
    case "event.windows":
      return changeEvent(form, viewer, true);
    case "participants.import":
      return importParticipants(form, viewer);
    case "participants.create":
    case "participants.update":
    case "participants.remove":
    case "participants.restore":
      return manageParticipant(form, viewer, intent.split(".")[1]);
    case "team.create":
      return createTeam(form, viewer);
    case "team.invite":
      return inviteToTeam(form, viewer);
    case "invitation.respond":
      return respondToInvitation(form, viewer);
    case "invitation.cancel":
      return respondToInvitation(form, viewer, true);
    case "team.remove":
      return removeFromTeam(form, viewer, false);
    case "team.leave":
      return removeFromTeam(form, viewer, true);
    case "project.save":
      return saveProject(form, viewer);
    case "project.moderate":
      return moderateProject(form, viewer);
    case "vote.add":
    case "vote.withdraw":
      return setVote(form, viewer, intent === "vote.withdraw");
    case "credits.offer.save":
      return saveCreditOffer(form, viewer);
    case "credits.import":
      return importCredits(form, viewer);
    case "credits.assign":
      return assignCredits(form, viewer);
    case "credits.claim":
      return claimCredit(form, viewer);
    default:
      throw new DomainError("This action is not supported.");
  }
}
