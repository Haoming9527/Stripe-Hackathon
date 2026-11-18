import { describe, expect, it } from "vitest";
import {
  emailIsAdmin,
  isConfiguredValue,
  normalizeIdentityEmail,
  safeCallbackPath,
} from "../lib/auth-policy";

describe("authentication identity boundaries", () => {
  it("does not merge Gmail dots or plus aliases", () => {
    expect(normalizeIdentityEmail(" Builder+team@Gmail.com ")).toBe(
      "builder+team@gmail.com",
    );
    expect(normalizeIdentityEmail("build.er@gmail.com")).not.toBe(
      normalizeIdentityEmail("builder@gmail.com"),
    );
  });

  it("does not grant admin by domain or partial email matches", () => {
    expect(
      emailIsAdmin(
        "Admin@Example.com",
        " admin@example.com, second@example.com",
      ),
    ).toBe(true);
    expect(emailIsAdmin("other@example.com", "admin@example.com")).toBe(false);
    expect(
      emailIsAdmin("admin@example.com.evil.test", "admin@example.com"),
    ).toBe(false);
    expect(emailIsAdmin("", "")).toBe(false);
  });
});

describe("sign-in destinations and setup", () => {
  it("accepts internal return paths and rejects external or backslash redirects", () => {
    expect(safeCallbackPath("/hackathons/build/portal?tab=team")).toBe(
      "/hackathons/build/portal?tab=team",
    );
    for (const value of [
      "https://evil.test",
      "//evil.test",
      "/\\evil.test",
      "/api/auth/signout",
      "/\n/evil.test",
    ])
      expect(safeCallbackPath(value)).toBe("/");
  });

  it("keeps missing or placeholder provider settings disabled", () => {
    for (const value of [
      undefined,
      "",
      " ",
      "replace-with-a-secret",
      "your_client_id",
      "<secret>",
    ])
      expect(isConfiguredValue(value)).toBe(false);
    expect(isConfiguredValue("a-real-configured-value")).toBe(true);
  });

  it("returns a single-rooted path after normalization", () => {
    expect(safeCallbackPath("/nested/../hackathons")).toBe("/hackathons");
    expect(safeCallbackPath("/nested/..//")).toBe("/");
  });
});
