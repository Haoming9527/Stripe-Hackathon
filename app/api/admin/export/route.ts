import { NextRequest, NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { auditSecurityEvent } from "@/lib/security/audit";

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) {
    auditSecurityEvent({ event: "export.denied", actorId: viewer?.id });
    return NextResponse.json(
      { error: "Administrator access is required." },
      { status: 403 },
    );
  }
  const hackathonId = request.nextUrl.searchParams.get("hackathonId");
  const type = request.nextUrl.searchParams.get("type");
  if (!hackathonId || !["participants", "votes"].includes(type || ""))
    return NextResponse.json(
      { error: "Choose a hackathon and export type." },
      { status: 400 },
    );
  const event = await prisma.hackathon.findUnique({
    where: { id: hackathonId },
    select: { slug: true },
  });
  if (!event)
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  let rows: unknown[][];
  if (type === "participants") {
    const people = await prisma.participant.findMany({
      where: { hackathonId },
      select: {
        normalizedEmail: true, name: true, userId: true, revokedAt: true,
        team: { select: { name: true } },
      },
      orderBy: { normalizedEmail: "asc" },
    });
    rows = [
      ["Email", "Name", "Team", "Registered", "Status"],
      ...people.map((p) => [
        p.normalizedEmail,
        p.name,
        p.team?.name,
        p.userId ? "Yes" : "No",
        p.revokedAt ? "Revoked" : "Active",
      ]),
    ];
  } else {
    const projects = await prisma.project.findMany({
      where: { hackathonId, publishedAt: { not: null } },
      select: {
        name: true, status: true,
        team: { select: { name: true } },
        _count: { select: { votes: true } },
      },
      orderBy: { name: "asc" },
    });
    rows = [
      ["Project", "Team", "Status", "Votes"],
      ...projects.map((p) => [p.name, p.team.name, p.status, p._count.votes]),
    ];
  }
  auditSecurityEvent({ event: "export.succeeded", actorId: viewer.id, intent: type || undefined });
  return new NextResponse(
    `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`,
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${event.slug}-${type}.csv"`,
        "Cache-Control": "private, no-store",
      },
    },
  );
}
