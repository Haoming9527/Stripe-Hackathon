import { vi } from "vitest";

// The marker is enforced by Next.js; unit tests exercise these modules in Node.
vi.mock("server-only", () => ({}));
