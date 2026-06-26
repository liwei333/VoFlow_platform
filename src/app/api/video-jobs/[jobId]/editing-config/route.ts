import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  internalError,
  invalidJsonBody,
  notFound,
  success,
  validationError,
} from "@/lib/api-response";
import { EDITING_ERROR_CODES } from "@/lib/editing/constants";
import { saveEditingConfigSchema } from "@/lib/editing/validation";
import {
  getEditingConfigForJob,
  saveEditingConfigForJob,
} from "@/services/editingConfigService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;
  const { jobId } = await params;

  try {
    const result = await getEditingConfigForJob({
      jobId,
      teamId: session.teamId,
    });

    if (!result.success) {
      if (result.error.code === EDITING_ERROR_CODES.jobNotFound) {
        return notFound(result.error.message);
      }

      return internalError(result.error.message);
    }

    return success(result.data);
  } catch (error) {
    console.error("Get editing config error:", error);
    return internalError();
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;
  const { jobId } = await params;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidJsonBody();
    }

    const parsed = saveEditingConfigSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors);
    }

    const result = await saveEditingConfigForJob({
      jobId,
      teamId: session.teamId,
      ...parsed.data,
    });

    if (!result.success) {
      if (result.error.code === EDITING_ERROR_CODES.jobNotFound) {
        return notFound(result.error.message);
      }

      if (
        result.error.code === EDITING_ERROR_CODES.pipAssetLicenseNotApproved ||
        result.error.code === EDITING_ERROR_CODES.pipAssetTypeUnsupported ||
        result.error.code ===
          EDITING_ERROR_CODES.backgroundAssetLicenseNotApproved ||
        result.error.code === EDITING_ERROR_CODES.backgroundAssetTypeUnsupported
      ) {
        return NextResponse.json(result.error, { status: 400 });
      }

      return internalError(result.error.message);
    }

    return success(result.data, "剪辑配置已保存");
  } catch (error) {
    console.error("Save editing config error:", error);
    return internalError();
  }
}
