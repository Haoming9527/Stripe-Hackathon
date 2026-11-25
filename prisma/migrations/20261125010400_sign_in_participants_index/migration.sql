CREATE INDEX CONCURRENTLY "Participant_normalizedEmail_userId_idx"
ON "Participant" ("normalizedEmail", "userId");
