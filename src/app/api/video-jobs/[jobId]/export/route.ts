import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import {
  internalError,
  invalidJsonBody,
  notFound,
  success,
  validationError,
} from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { EXPORT_ERROR_CODES } from "@/lib/export/constants";
import { createFinalExportTask } from "@/services/exportTaskService";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

const createExportRequestSchema = z.object({
  outputProfile: z.enum(["mp4_720p", "mp4_1080p"]).default("mp4_1080p"),
  bgmAssetId: z.string().trim().min(1).nullable().optional(),
  coverArtifactId: z.string().trim().min(1).nullable().optional(),
});

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { jobId } = await context.params;
  const job = await prisma.videoJob.findFirst({
    where: {
      id: jobId,
      teamId: auth.context.session.teamId,
    },
    select: {
      id: true,
    },
  });

  if (!job) {
    return notFound("视频任务不存在");
  }

  const requests = await prisma.exportRequest.findMany({
    where: {
      jobId,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      node: {
        select: {
          id: true,
          status: true,
          output: true,
          error: true,
          artifacts: {
            where: {
              type: "final_video",
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
            select: {
              id: true,
              type: true,
              storageUrl: true,
              metadata: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  return success({
    requests: requests.map((request) => ({
      id: request.id,
      jobId: request.jobId,
      nodeId: request.nodeId,
      outputProfile: request.outputProfile,
      status: request.status,
      avatarVideoArtifactId: request.avatarVideoArtifactId,
      audioArtifactId: request.audioArtifactId,
      subtitleArtifactId: request.subtitleArtifactId,
      bgmAssetId: request.bgmAssetId,
      coverArtifactId: request.coverArtifactId,
      errorJson: request.errorJson,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      node: request.node,
      finalVideoArtifact: request.node.artifacts[0]
        ? {
            ...request.node.artifacts[0],
            createdAt: request.node.artifacts[0].createdAt.toISOString(),
          }
        : null,
    })),
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidJsonBody();
  }

  const parsed = createExportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const { jobId } = await context.params;
  try {
    const result = await createFinalExportTask({
      jobId,
      teamId: auth.context.session.teamId,
      outputProfile: parsed.data.outputProfile,
      bgmAssetId: parsed.data.bgmAssetId,
      coverArtifactId: parsed.data.coverArtifactId,
    });

    if (!result.success) {
      if (result.error.code === EXPORT_ERROR_CODES.exportJobNotFound) {
        return notFound(result.error.message);
      }

      return validationError(
        [{ path: ["export"], message: result.error.message, code: result.error.code }],
        result.error.message
      );
    }

    return success(result.data, "导出任务已创建");
  } catch (error) {
    console.error("Create final export task error:", error);
    return internalError();
  }
}
