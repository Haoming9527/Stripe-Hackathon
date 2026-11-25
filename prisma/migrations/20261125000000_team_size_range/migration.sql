ALTER TABLE "Hackathon"
  ADD COLUMN "minTeamSize" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "teamSizeCeiling" INTEGER NOT NULL DEFAULT 4;

UPDATE "Hackathon" SET "teamSizeCeiling" = "maxTeamSize";

ALTER TABLE "Hackathon" ADD CONSTRAINT "Hackathon_team_size_range"
  CHECK (1 <= "minTeamSize" AND "minTeamSize" <= "maxTeamSize"
    AND "maxTeamSize" <= "teamSizeCeiling" AND "teamSizeCeiling" <= 100);
