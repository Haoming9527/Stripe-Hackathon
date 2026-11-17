import styles from "@/components/admin/styles";

export default function AdminLoading() {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <span className={styles.loadingDot} /> Loading your workspace…
    </div>
  );
}
