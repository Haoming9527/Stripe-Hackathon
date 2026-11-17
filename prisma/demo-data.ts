import type { PrismaClient } from "@prisma/client";

/** Explicit development fixtures. Importing this module has no side effects. */
export async function seedDemo(prisma: PrismaClient) {
  if (process.env.SEED_DEMO !== "true")
    throw new Error("Set SEED_DEMO=true explicitly for development seeding.");
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seeding is disabled in production.");
  const now = Date.now();
  const day = 86_400_000;
  const past = now - 35 * day;
  const people = [
    { id: "demo-user-aria", name: "Aria Chen", email: "aria.demo@example.com" },
    {
      id: "demo-user-elliot",
      name: "Elliot Tan",
      email: "elliot.demo@example.com",
    },
    { id: "demo-user-mina", name: "Mina Park", email: "mina.demo@example.com" },
    { id: "demo-user-noah", name: "Noah Lim", email: "noah.demo@example.com" },
    {
      id: "demo-user-priya",
      name: "Priya Shah",
      email: "priya.demo@example.com",
    },
    { id: "demo-user-sam", name: "Sam Rivera", email: "sam.demo@example.com" },
  ];

  return prisma.$transaction(
    async (tx) => {
      for (const person of people) {
        await tx.user.upsert({
          where: { id: person.id },
          create: { ...person, emailVerified: new Date() },
          update: {},
        });
        await tx.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: "google",
              providerAccountId: person.id,
            },
          },
          create: {
            id: `${person.id}-account`,
            userId: person.id,
            provider: "google",
            providerAccountId: person.id,
            type: "oauth",
          },
          update: {},
        });
      }
      const active = await tx.hackathon.upsert({
        where: { id: "demo-event-active" },
        update: {},
        create: {
          id: "demo-event-active",
          slug: "build-with-stripe",
          title: "Build with Stripe",
          tagline: "A weekend for ideas that move the internet forward.",
          description:
            "Bring an idea, find your people, and build something useful. Explore new ways to accept payments, help businesses grow, and make the internet economy work for more people. This event is development sample content.",
          location: "Singapore + online",
          timezone: "Asia/Singapore",
          status: "ACTIVE",
          startsAt: new Date(now - 4 * 3_600_000),
          endsAt: new Date(now + 2 * day),
          submissionOpensAt: new Date(now - day),
          submissionClosesAt: new Date(now + day),
          votingOpensAt: new Date(now - 2 * 3_600_000),
          votingClosesAt: new Date(now + 2 * day),
          maxTeamSize: 4,
          votesPerUser: 3,
          maxTrackSelections: 2,
          meetingUrl: "https://example.com/community-meeting",
          attendeeInfo:
            "Welcome, builders. Check in with an organizer when you arrive. Bring a laptop, charger, and an idea you would like to explore. The meeting link is a development placeholder.",
          schedule: [
            { time: "09:00", label: "Doors open and introductions" },
            { time: "10:00", label: "Kickoff and developer workshop" },
            { time: "11:00", label: "Build time and mentor office hours" },
            { time: "17:00", label: "Project demos and community showcase" },
          ],
          resources: [
            {
              title: "Stripe developer documentation",
              url: "https://docs.stripe.com/",
            },
            {
              title: "Payments quickstart",
              url: "https://docs.stripe.com/payments/quickstart",
            },
            {
              title: "Stripe sample projects",
              url: "https://github.com/stripe-samples",
            },
          ],
          prizes: [
            {
              title: "Best community project",
              description:
                "A project that opens new possibilities for people and businesses.",
            },
            {
              title: "Best developer experience",
              description:
                "Thoughtful tools that make building with Stripe simpler.",
            },
          ],
        },
      });
      const ended = await tx.hackathon.upsert({
        where: { id: "demo-event-ended" },
        update: {},
        create: {
          id: "demo-event-ended",
          slug: "community-build-sprint",
          title: "Community Build Sprint",
          tagline: "Small teams. Useful tools. A day well spent.",
          description:
            "A community sprint exploring everyday problems for independent businesses. Browse the finished projects from this development sample event.",
          location: "Online",
          timezone: "Asia/Singapore",
          status: "ENDED",
          startsAt: new Date(past),
          endsAt: new Date(past + day),
          submissionOpensAt: new Date(past),
          submissionClosesAt: new Date(past + 20 * 3_600_000),
          votingOpensAt: new Date(past + 20 * 3_600_000),
          votingClosesAt: new Date(past + day),
          submissionsClosed: true,
          votingClosed: true,
          maxTeamSize: 3,
          votesPerUser: 3,
          maxTrackSelections: 1,
          schedule: [
            { time: "10:00", label: "Community kickoff" },
            { time: "18:00", label: "Showcase and closing" },
          ],
          resources: [
            { title: "Stripe documentation", url: "https://docs.stripe.com/" },
          ],
          prizes: [
            {
              title: "Community choice",
              description: "Celebrating thoughtful, useful work.",
            },
          ],
        },
      });
      const tracks = [
        {
          id: "demo-track-payments",
          hackathonId: active.id,
          name: "Future of payments",
          description: "Make moving money feel effortless.",
          position: 0,
        },
        {
          id: "demo-track-platforms",
          hackathonId: active.id,
          name: "Platforms for everyone",
          description: "Help communities build sustainable businesses.",
          position: 1,
        },
        {
          id: "demo-track-developers",
          hackathonId: active.id,
          name: "Developer tools",
          description: "Make the next integration a little easier.",
          position: 2,
        },
      ];
      for (const track of tracks)
        await tx.track.upsert({
          where: { id: track.id },
          create: track,
          update: {},
        });
      const projects = [
        {
          id: "openlane",
          eventId: active.id,
          owner: people[0],
          teammate: people[1],
          teamName: "Openlane Studio",
          name: "Openlane",
          trackId: tracks[0].id,
          description:
            "A calmer way for freelancers to get paid. Turn a project brief into clear milestones, share progress with clients, and keep every invoice in one place.",
        },
        {
          id: "kindred",
          eventId: active.id,
          owner: people[2],
          teamName: "Kindred Collective",
          name: "Kindred",
          trackId: tracks[1].id,
          description:
            "Local makers, one beautiful storefront. A lightweight marketplace that helps neighborhood creators share their work and build lasting customer relationships.",
        },
        {
          id: "relay",
          eventId: active.id,
          owner: people[3],
          teamName: "Relay Labs",
          name: "Relay",
          trackId: tracks[2].id,
          description:
            "Follow a payment from the first API call to the final webhook. Relay gives developers a readable timeline for debugging and sharing integration issues.",
        },
        {
          id: "littlefund",
          eventId: active.id,
          owner: people[4],
          teammate: people[5],
          teamName: "Small Steps",
          name: "Littlefund",
          trackId: tracks[1].id,
          description:
            "Make ambitious community projects possible with small recurring contributions. Organizers see progress, while supporters see what their contribution makes happen.",
        },
        {
          id: "invoice-garden",
          eventId: ended.id,
          owner: people[0],
          teamName: "Garden Studio",
          name: "Invoice Garden",
          description:
            "A friendly workspace for independent consultants: plan work, send clear invoices, and spend less time chasing payment.",
        },
        {
          id: "workshop-pass",
          eventId: ended.id,
          owner: people[2],
          teammate: people[3],
          teamName: "Workshop Club",
          name: "Workshop Pass",
          description:
            "One simple booking page for local classes. Instructors share upcoming workshops, manage attendance, and welcome their next group of learners.",
        },
      ];
      for (const [index, project] of projects.entries()) {
        const teamId = `demo-team-${project.id}`;
        const projectId = `demo-project-${project.id}`;
        const publishedAt = new Date(
          project.eventId === active.id
            ? now - (index + 1) * 3_600_000
            : past + (index + 1) * 3_600_000,
        );
        await tx.team.upsert({
          where: { id: teamId },
          create: {
            id: teamId,
            hackathonId: project.eventId,
            name: project.teamName,
            ownerId: project.owner.id,
            rosterLockedAt: publishedAt,
          },
          update: {},
        });
        const members = [
          project.owner,
          ...(project.teammate ? [project.teammate] : []),
        ];
        for (const member of members)
          await tx.participant.upsert({
            where: {
              hackathonId_normalizedEmail: {
                hackathonId: project.eventId,
                normalizedEmail: member.email,
              },
            },
            create: {
              id: `${project.eventId}-${member.id}`,
              hackathonId: project.eventId,
              normalizedEmail: member.email,
              name: member.name,
              userId: member.id,
              teamId,
            },
            update: {},
          });
        await tx.project.upsert({
          where: { id: projectId },
          update: {},
          create: {
            id: projectId,
            teamId,
            hackathonId: project.eventId,
            name: project.name,
            description: project.description,
            demoUrl: `https://example.com/demos/${project.id}`,
            videoUrl: `https://example.com/demos/${project.id}/video`,
            githubUrl: `https://github.com/example/${project.id}`,
            status: "SUBMITTED",
            publishedAt,
            consentAt: publishedAt,
            consentUserId: project.owner.id,
            contributorIds: members.map((member) => member.id),
          },
        });
        if (project.trackId)
          await tx.projectTrack.upsert({
            where: {
              projectId_trackId: { projectId, trackId: project.trackId },
            },
            create: { projectId, trackId: project.trackId },
            update: {},
          });
      }
      await tx.creditOffer.upsert({
        where: { id: "demo-offer-builder-credits" },
        update: {},
        create: {
          id: "demo-offer-builder-credits",
          hackathonId: active.id,
          name: "Builder credits",
          sponsor: "Community sponsor",
          valueLabel: "$100 in development credits",
          description: "An example sponsor benefit for your next prototype.",
          instructions:
            "Development sample only. Upload real sponsor codes and assign them before participants can claim this offer.",
          redemptionUrl: "https://example.com/redeem",
          expiresAt: new Date(now + 30 * day),
        },
      });
      return {
        activeEventId: active.id,
        activeSlug: active.slug,
        endedEventId: ended.id,
        endedSlug: ended.slug,
        projectIds: projects.map((project) => `demo-project-${project.id}`),
        userIds: people.map((person) => person.id),
      };
    },
    { timeout: 60_000 },
  );
}
