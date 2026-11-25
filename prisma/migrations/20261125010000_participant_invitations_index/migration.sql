CREATE INDEX CONCURRENTLY "TeamInvitation_participantId_status_idx"
ON "TeamInvitation" ("participantId", "status");
