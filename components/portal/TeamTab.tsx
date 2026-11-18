import "server-only";
import { LockKeyhole, Mail, Plus, Users } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import type { PortalData } from "./data";

export function TeamTab({
  event,
  team,
  viewer,
  participant,
  canManageTeam,
  teamsOpen,
  invitations,
}: Pick<
  PortalData,
  | "event"
  | "team"
  | "viewer"
  | "participant"
  | "canManageTeam"
  | "teamsOpen"
  | "invitations"
>) {
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Better together</p>
          <h2>{team ? team.name : "Find your people."}</h2>
          <p className="muted">
            One team. One shared project. Up to {event.maxTeamSize}{" "}
            {event.maxTeamSize === 1 ? "builder" : "builders"}.
          </p>
        </div>
        {team && (
          <span className="badge">
            {team._count.members} / {event.maxTeamSize} members
          </span>
        )}
      </div>
      {team ? (
        <div className="portal-columns">
          <div className="panel">
            <h3>Your crew</h3>
            <div className="member-list">
              {team.members.map((member) => (
                <div className="member-row" key={member.id}>
                  <span className="member-avatar">
                    {(
                      member.user?.name ||
                      member.name ||
                      member.normalizedEmail
                    )
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>
                  <div>
                    <strong>
                      {member.user?.name ||
                        member.name ||
                        member.normalizedEmail.split("@")[0]}
                      {member.userId === team.ownerId && (
                        <span className="member-role">Owner</span>
                      )}
                      {member.revokedAt && (
                        <span className="member-role">Access revoked</span>
                      )}
                    </strong>
                    <small>{member.normalizedEmail}</small>
                  </div>
                  {canManageTeam && member.userId !== viewer.id && (
                    <ActionForm intent="team.remove">
                      <input type="hidden" name="teamId" value={team.id} />
                      <input
                        type="hidden"
                        name="participantId"
                        value={member.id}
                      />
                      <button className="text-button danger-text" type="submit">
                        Remove
                      </button>
                    </ActionForm>
                  )}
                </div>
              ))}
            </div>
            {team.rosterLockedAt ? (
              <div className="notice">
                <LockKeyhole size={16} /> Your roster is locked because your
                project has been published.
              </div>
            ) : !teamsOpen ? (
              <div className="notice">Team changes are closed.</div>
            ) : (
              <ActionForm intent="team.leave">
                <input type="hidden" name="teamId" value={team.id} />
                <button type="submit" className="text-button danger-text">
                  {team.ownerId === viewer.id
                    ? "Leave and dissolve team"
                    : "Leave team"}
                </button>
                {team.ownerId === viewer.id && (
                  <p className="field-hint">
                    Only an owner with no other members can dissolve a team.
                  </p>
                )}
              </ActionForm>
            )}
          </div>
          <div className="stack">
            {canManageTeam && (
              <div className="panel">
                <h3>
                  <Mail size={18} /> Invite a teammate
                </h3>
                <p className="muted">
                  Use the email they registered with. Ask them to open the Team
                  tab in their portal to accept.
                </p>
                <ActionForm intent="team.invite" className="stack">
                  <input type="hidden" name="teamId" value={team.id} />
                  <label className="field">
                    Email address
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="teammate@example.com"
                    />
                  </label>
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={team._count.members >= event.maxTeamSize}
                  >
                    <Plus size={16} /> Send invitation
                  </button>
                </ActionForm>
              </div>
            )}
            {team.invitations.length > 0 && (
              <div className="panel">
                <h3>Pending invitations</h3>
                {team.invitations.map((invite) => (
                  <div key={invite.id} className="invitation-row">
                    <div>
                      <strong>{invite.participant.normalizedEmail}</strong>
                      <small className="muted">
                        Awaiting acceptance in the portal
                      </small>
                    </div>
                    {canManageTeam && (
                      <div className="inline">
                        <ActionForm intent="invitation.cancel">
                          <input
                            type="hidden"
                            name="invitationId"
                            value={invite.id}
                          />
                          <button
                            className="text-button danger-text"
                            type="submit"
                          >
                            Cancel
                          </button>
                        </ActionForm>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="portal-columns">
          <div className="panel">
            <h3>Start a team</h3>
            <p className="muted">
              Have a name in mind? Create your team and invite your
              collaborators. Building solo is welcome, too.
            </p>
            <ActionForm intent="team.create" className="stack">
              <input type="hidden" name="hackathonId" value={event.id} />
              <label className="field">
                Team name
                <input
                  name="name"
                  required
                  maxLength={100}
                  placeholder="A name for your next big idea"
                  disabled={!participant || !teamsOpen}
                />
              </label>
              <button
                className="button button-primary"
                type="submit"
                disabled={!participant || !teamsOpen}
              >
                <Plus size={16} /> Create team
              </button>
              {!teamsOpen && <p className="muted">Team creation is closed.</p>}
            </ActionForm>
          </div>
          <div className="panel">
            <h3>Your invitations</h3>
            {invitations.length ? (
              invitations.map((invite) => (
                <div key={invite.id} className="invitation-row">
                  <div>
                    <strong>{invite.team.name}</strong>
                    <p className="muted">
                      From {invite.team.owner.name || "the team owner"} ·{" "}
                      {invite.team._count.members} members
                    </p>
                  </div>
                  <ActionForm intent="invitation.respond">
                    <input
                      type="hidden"
                      name="invitationId"
                      value={invite.id}
                    />
                    <div className="inline">
                      <button
                        className="button button-small button-primary"
                        type="submit"
                        name="response"
                        value="accept"
                        disabled={!teamsOpen}
                      >
                        Accept invitation
                      </button>
                      <button
                        className="text-button"
                        type="submit"
                        name="response"
                        value="decline"
                      >
                        Decline
                      </button>
                    </div>
                  </ActionForm>
                </div>
              ))
            ) : (
              <div className="small-empty">
                <Users size={26} />
                <p>No invitations yet.</p>
                <span className="muted">
                  Share your registered email with a team owner to receive one.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
