import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { internalError, success, validationError } from "@/lib/api-response";
import { listAvailableVoices } from "@/services/voiceService";

const listVoicesQuerySchema = z.object({
  gender: z.string().trim().min(1).optional(),
  style: z.string().trim().min(1).optional(),
  language: z.string().trim().min(1).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;

  try {
    const queryParams = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = listVoicesQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
      return validationError(parsed.error.errors);
    }

    const result = await listAvailableVoices({
      teamId: session.teamId,
      filters: parsed.data,
    });

    if (!result.success) {
      return internalError(result.error.message);
    }

    return success(result.data);
  } catch (error) {
    console.error("List voices error:", error);
    return internalError();
  }
}
