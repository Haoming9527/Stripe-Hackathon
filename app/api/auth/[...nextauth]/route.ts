import NextAuth from "next-auth";
import { NextRequest } from "next/server";
import { authOptions, missingAuthSettings } from "@/lib/auth";

export const runtime = "nodejs";

const handler = NextAuth(authOptions);

async function authHandler(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> },
) {
  if (missingAuthSettings().length) {
    return Response.json(
      {
        error:
          "Sign-in is not configured. Ask the administrator to finish authentication setup.",
      },
      { status: 503 },
    );
  }
  return handler(request, context);
}

export { authHandler as GET, authHandler as POST };
