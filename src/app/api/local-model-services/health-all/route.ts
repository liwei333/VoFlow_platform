import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { internalError, success } from "@/lib/api-response";
import { checkAndUpdateAllLocalModelServices } from "@/services/localModelService";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const services = await checkAndUpdateAllLocalModelServices();
    return success({ services });
  } catch (error) {
    console.error("Check all local model services error:", error);
    return internalError();
  }
}
