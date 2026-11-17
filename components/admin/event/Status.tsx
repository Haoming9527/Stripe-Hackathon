import styles from "../styles";

export function Status({ status }: { status: string }) {
  const style =
    status === "ACTIVE" || status === "SUBMITTED" || status === "ACCEPTED"
      ? styles.active
      : status === "DRAFT" || status === "PENDING"
        ? styles.draft
        : status === "HIDDEN"
          ? styles.danger
          : styles.ended;
  return (
    <span className={`${styles.badge} ${style}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
