import { LocalModelServiceType } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { internalError, notFound, success, validationError } from "@/lib/api-response";
import { LOCAL_MODEL_SERVICE_DEFINITIONS } from "@/lib/local-model/config";
import { checkAndUpdateLocalModelService } from "@/services/localModelService";

const ALLOWED_SERVICE_TYPES = new Set(LOCAL_MODEL_SERVICE_DEFINITIONS.map((service) => service.type));

interface RouteContext {
  params: Promise<{ serviceType: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { serviceType } = await context.params;
  if (!ALLOWED_SERVICE_TYPES.has(serviceType as LocalModelServiceType)) {
    return validationError([{ path: ["serviceType"], message: "本地模型服务类型无效" }]);
  }

  try {
    const service = await checkAndUpdateLocalModelService(serviceType as LocalModelServiceType);
    if (!service) {
      return notFound("本地模型服务不存在");
    }
    return success({ service });
  } catch (error) {
    console.error("Check local model service error:", error);
    return internalError();
  }
}
