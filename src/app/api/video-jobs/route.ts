import { VideoJobStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { internalError, success, validationError } from "@/lib/api-response";
import { listWorkflowJobs } from "@/services/workflowJobListService";

const listWorkflowJobsQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).optional().default("1"),
  pageSize: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default("20"),
  projectId: z.string().min(1).optional(),
  status: z.nativeEnum(VideoJobStatus).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;

  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const parsed = listWorkflowJobsQuerySchema.safeParse(queryParams);

    if (!parsed.success) {
      return validationError(parsed.error.errors);
    }

    const result = await listWorkflowJobs({
      teamId: session.teamId,
      ...parsed.data,
    });

    return success(result);
  } catch (error) {
    console.error("List workflow jobs error:", error);
    return internalError();
  }
}
