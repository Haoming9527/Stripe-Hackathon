/** Identity policy shared by the OAuth flow and its tests. Never collapse aliases. */
export function normalizeIdentityEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isConfiguredValue(value: string | undefined): value is string {
  if (!value?.trim()) return false;
  return !/^(?:change[-_]?me|replace[-_ ].*|your[-_ ].*|placeholder.*|example.*|todo.*|<[^>]+>)$/i.test(
    value.trim(),
  );
}

/** Only application paths are accepted as post-login destinations. */
export function safeCallbackPath(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    return "/";
  try {
    const parsed = new URL(value, "https://community.invalid");
    if (
      parsed.origin !== "https://community.invalid" ||
      parsed.pathname.startsWith("/api/auth")
    )
      return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

export function emailIsAdmin(
  email: string,
  allowlist: string | undefined,
): boolean {
  const normalized = normalizeIdentityEmail(email);
  return (
    Boolean(normalized) &&
    (allowlist ?? "")
      .split(/[\s,;]+/)
      .some(
        (entry) =>
          isConfiguredValue(entry) &&
          normalizeIdentityEmail(entry) === normalized,
      )
  );
}
