import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import {
  internalError,
  invalidJsonBody,
  notFound,
  success,
  validationError,
} from "@/lib/api-response";
import {
  PUBLISH_DRAFT_ERROR_CODES,
  updatePublishDraft,
} from "@/services/publishDraftService";

interface RouteContext {
  params: Promise<{ draftId: string }>;
}

const updatePublishDraftSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
    topics: z.array(z.string().trim().min(1)).optional(),
    coverArtifactId: z.string().trim().min(1).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    path: ["body"],
    message: "至少需要修改一个字段",
  });

export async function PUT(request: NextRequest, context: RouteContext) {
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

  const parsed = updatePublishDraftSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const { draftId } = await context.params;

  try {
    const result = await updatePublishDraft({
      draftId,
      teamId: auth.context.session.teamId,
      ...parsed.data,
    });

    if (!result.success) {
      if (
        result.error.code === PUBLISH_DRAFT_ERROR_CODES.draftNotFound ||
        result.error.code === PUBLISH_DRAFT_ERROR_CODES.coverNotFound
      ) {
        return notFound(result.error.message);
      }

      if (
        result.error.code === PUBLISH_DRAFT_ERROR_CODES.titleTooLong ||
        result.error.code === PUBLISH_DRAFT_ERROR_CODES.tagsTooMany
      ) {
        return NextResponse.json(result.error, { status: 400 });
      }

      return internalError(result.error.message);
    }

    return success(result.data, "发布草稿已保存");
  } catch (error) {
    console.error("Update publish draft error:", error);
    return internalError();
  }
}
