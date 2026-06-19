import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSessionToken } from "@/lib/auth";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        teamMemberships: {
          where: { role: "owner" },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { code: "AUTH_INVALID_CREDENTIALS", message: "账号或密码错误" },
        { status: 401 }
      );
    }

    if (user.status === "disabled") {
      return NextResponse.json(
        { code: "AUTH_USER_DISABLED", message: "账号已被禁用" },
        { status: 403 }
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { code: "AUTH_INVALID_CREDENTIALS", message: "账号或密码错误" },
        { status: 401 }
      );
    }

    // Get user's team
    const teamMember = user.teamMemberships[0];
    const teamId = teamMember?.teamId || "";

    const sessionToken = await createSessionToken({
      userId: user.id,
      teamId,
      email: user.email!,
      name: user.name,
    });

    const response = NextResponse.json({
      code: "SUCCESS",
      message: "登录成功",
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
    });

    response.cookies.set("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "参数错误", errors: error.errors },
        { status: 400 }
      );
    }
    console.error("Login error:", error);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "服务器内部错误" },
      { status: 500 }
    );
  }
}
