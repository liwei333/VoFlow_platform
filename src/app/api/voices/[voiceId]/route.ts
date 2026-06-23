import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { internalError, notFound, success } from "@/lib/api-response";
import { serializeVoice } from "@/lib/tts/serializer";
import { disableClonedVoice } from "@/services/voiceService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ voiceId: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;
  const { voiceId } = await params;

  try {
    const voice = await prisma.voice.findFirst({
      where: {
        id: voiceId,
        status: "active",
        licenseStatus: "approved",
        deletedAt: null,
        OR: [{ teamId: null }, { teamId: session.teamId }],
      },
    });

    if (!voice) {
      return notFound("音色不存在");
    }

    return success({ voice: serializeVoice(voice) });
  } catch (error) {
    console.error("Get voice error:", error);
    return internalError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ voiceId: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;
  const { voiceId } = await params;

  try {
    const result = await disableClonedVoice({
      voiceId,
      teamId: session.teamId,
    });

    if (!result.success) {
      if (result.error.code === "VOICE_NOT_FOUND") {
        return notFound(result.error.message);
      }

      return internalError(result.error.message);
    }

    return success(result.data);
  } catch (error) {
    console.error("Delete voice error:", error);
    return internalError();
  }
}
