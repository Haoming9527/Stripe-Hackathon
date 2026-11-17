import "server-only";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";

export async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?callbackUrl=/admin");
  if (!viewer.isAdmin) notFound();
  return viewer;
}
