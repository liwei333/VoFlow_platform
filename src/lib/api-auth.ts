import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, type Session } from "@/lib/auth";
import { prisma } from "@/lib/db";

export interface AuthContext {
  session: Session;
  user: {
    id: string;
    email: string;
    name: string;
    status: "active" | "disabled";
  };
}

/**
 * Unified authentication and authorization helper for API routes.
 * Validates:
 * 1. Session cookie exists and JWT is valid
 * 2. User exists and status !== disabled
 * 3. Session.teamId corresponds to user's current team membership
 * 4. Rejects disabled users even with valid cookies
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ error: NextResponse } | { success: true; context: AuthContext }> {
  const sessionToken = request.cookies.get("session")?.value;

  if (!sessionToken) {
    return {
      error: NextResponse.json(
        { code: "UNAUTHORIZED", message: "未登录" },
        { status: 401 }
      ),
    };
  }

  const session = await verifySessionToken(sessionToken);
  if (!session) {
    return {
      error: NextResponse.json(
        { code: "UNAUTHORIZED", message: "会话无效" },
        { status: 401 }
      ),
    };
  }

  // Fetch user with team membership validation
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
    },
  });

  if (!user) {
    return {
      error: NextResponse.json(
        { code: "UNAUTHORIZED", message: "用户不存在" },
        { status: 401 }
      ),
    };
  }

  if (user.status === "disabled") {
    return {
      error: NextResponse.json(
        { code: "AUTH_USER_DISABLED", message: "账号已被禁用" },
        { status: 403 }
      ),
    };
  }

  // Verify team membership still exists
  const membership = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId: session.teamId,
        userId: session.userId,
      },
    },
  });

  if (!membership) {
    return {
      error: NextResponse.json(
        { code: "UNAUTHORIZED", message: "团队权限已失效" },
        { status: 401 }
      ),
    };
  }

  return {
    success: true,
    context: {
      session,
      user: {
        id: user.id,
        email: user.email || session.email,
        name: user.name,
        status: user.status,
      },
    },
  };
}
