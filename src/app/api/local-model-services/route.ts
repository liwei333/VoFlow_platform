import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { internalError, success } from "@/lib/api-response";
import { listLocalModelServices } from "@/services/localModelService";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const services = await listLocalModelServices();
    return success({ services });
  } catch (error) {
    console.error("List local model services error:", error);
    return internalError();
  }
}
