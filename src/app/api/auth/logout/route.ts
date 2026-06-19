import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({
    code: "SUCCESS",
    message: "已退出登录",
  });

  response.cookies.set("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
