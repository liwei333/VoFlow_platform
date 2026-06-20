import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { internalError, invalidJsonBody, notFound, success, validationError } from "@/lib/api-response";
import { listProjectScripts, savePastedScript, SCRIPT_CONTENT_MAX_LENGTH } from "@/services/scriptService";

const saveScriptSchema = z.object({
  content: z.string().transform((value) => value.trim()).pipe(z.string().min(1).max(SCRIPT_CONTENT_MAX_LENGTH)),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;
  const { projectId } = await params;

  try {
    const result = await listProjectScripts({
      projectId,
      teamId: session.teamId,
    });

    if (!result.success) {
      return notFound("项目不存在");
    }

    return success(result.data);
  } catch (error) {
    console.error("List scripts error:", error);
    return internalError();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;
  const { projectId } = await params;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidJsonBody();
    }

    const parsed = saveScriptSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors);
    }

    const result = await savePastedScript({
      projectId,
      teamId: session.teamId,
      content: parsed.data.content,
    });

    if (!result.success) {
      return notFound("项目不存在");
    }

    return success({ script: result.data }, "文案保存成功");
  } catch (error) {
    console.error("Save script error:", error);
    return internalError();
  }
}
