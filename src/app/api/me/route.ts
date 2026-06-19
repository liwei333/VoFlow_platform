import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { user, session } = auth.context;

  return NextResponse.json({
    code: "SUCCESS",
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      teamId: session.teamId,
    },
  });
}
