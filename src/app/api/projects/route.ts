import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { toPrismaAspectRatio, toApiAspectRatio } from "@/lib/aspect-ratio";
import { z } from "zod";

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  targetPlatform: z.string().min(1),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]),
});

// GET /api/projects - List projects
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;

  // Get projects for user's team
  const projects = await prisma.project.findMany({
    where: {
      teamId: session.teamId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      name: true,
      targetPlatform: true,
      aspectRatio: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Convert aspect ratio to API format
  const projectsWithApiFormat = projects.map((project) => ({
    ...project,
    aspectRatio: toApiAspectRatio(project.aspectRatio),
  }));

  return NextResponse.json({
    code: "SUCCESS",
    data: { projects: projectsWithApiFormat },
  });
}

// POST /api/projects - Create project
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;

  try {
    const body = await request.json();
    const { name, targetPlatform, aspectRatio } = createProjectSchema.parse(body);

    const project = await prisma.project.create({
      data: {
        name,
        targetPlatform,
        aspectRatio: toPrismaAspectRatio(aspectRatio),
        teamId: session.teamId,
        ownerId: session.userId,
        status: "active",
      },
      select: {
        id: true,
        name: true,
        targetPlatform: true,
        aspectRatio: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      code: "SUCCESS",
      message: "项目创建成功",
      data: {
        project: {
          ...project,
          aspectRatio: toApiAspectRatio(project.aspectRatio),
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "参数错误", errors: error.errors },
        { status: 400 }
      );
    }
    console.error("Create project error:", error);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "服务器内部错误" },
      { status: 500 }
    );
  }
}
