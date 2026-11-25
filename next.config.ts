import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security/headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["openid-client"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(process.env.NODE_ENV === "production") }];
  },
  experimental: {
    inlineCss: true,
    agentFeedback: true,
  },
};

export default nextConfig;
