import Link from "next/link";
import { AdminLiveUpdates } from "@/components/admin/AdminLiveUpdates";
import { SINGAPORE_COMMUNITY_URL } from "@/lib/community";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import styles from "@/components/admin/styles";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?callbackUrl=/admin");
  if (!viewer.isAdmin) {
    return (
      <section className="shell" style={{ paddingBlock: "6rem" }}>
        <div
          className="panel"
          style={{ maxWidth: 580, marginInline: "auto", padding: "2.5rem" }}
        >
          <h1>Organizer access required</h1>
          <p className="muted">
            Your account doesn’t have access to the admin dashboard. You can
            still explore the community’s projects and visit your participant
            portal.
          </p>
          <Link className="button button-primary" href="/hackathons">
            Explore hackathons
          </Link>
        </div>
      </section>
    );
  }
  return (
    <div className={styles.workspace}>
      <AdminLiveUpdates />
      <aside className={styles.sidebar}>
        <nav className={styles.navigation} aria-label="Admin navigation">
          <Link className={styles.navLink} href="/admin">
            Hackathons
          </Link>
          <Link className={styles.navLink} href="/admin/new">
            Create hackathon
          </Link>
          <a
            className={styles.navLink}
            href={SINGAPORE_COMMUNITY_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Community site
          </a>
        </nav>
      </aside>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
