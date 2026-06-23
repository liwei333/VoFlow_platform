import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serializeVoice, serializeVoices, type SerializedVoice } from "@/lib/tts/serializer";

export type ListAvailableVoicesInput = {
  teamId: string;
  filters?: {
    gender?: string;
    style?: string;
    language?: string;
  };
};

export type ListAvailableVoicesResult =
  | { success: true; data: { voices: SerializedVoice[] } }
  | { success: false; error: { code: "VOICE_LIST_FAILED"; message: string } };

export type DisableClonedVoiceInput = {
  voiceId: string;
  teamId: string;
};

export type DisableClonedVoiceResult =
  | { success: true; data: { voice: SerializedVoice } }
  | { success: false; error: { code: "VOICE_NOT_FOUND" | "VOICE_DISABLE_FAILED"; message: string } };

export async function listAvailableVoices(
  input: ListAvailableVoicesInput
): Promise<ListAvailableVoicesResult> {
  try {
    const where: Prisma.VoiceWhereInput = {
      status: "active",
      licenseStatus: "approved",
      deletedAt: null,
      OR: [{ teamId: null }, { teamId: input.teamId }],
    };

    if (input.filters?.gender) {
      where.gender = input.filters.gender;
    }

    if (input.filters?.style) {
      where.style = input.filters.style;
    }

    if (input.filters?.language) {
      where.language = input.filters.language;
    }

    const voices = await prisma.voice.findMany({
      where,
      orderBy: [{ voiceType: "asc" }, { createdAt: "asc" }],
    });

    return {
      success: true,
      data: {
        voices: serializeVoices(voices),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "VOICE_LIST_FAILED",
        message: error instanceof Error ? error.message : "音色列表加载失败",
      },
    };
  }
}

export async function disableClonedVoice(
  input: DisableClonedVoiceInput
): Promise<DisableClonedVoiceResult> {
  try {
    const voice = await prisma.voice.findFirst({
      where: {
        id: input.voiceId,
        teamId: input.teamId,
        voiceType: "cloned",
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!voice) {
      return {
        success: false,
        error: {
          code: "VOICE_NOT_FOUND",
          message: "克隆音色不存在",
        },
      };
    }

    const updatedVoice = await prisma.voice.update({
      where: {
        id: voice.id,
      },
      data: {
        status: "disabled",
      },
    });

    return {
      success: true,
      data: {
        voice: serializeVoice(updatedVoice),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "VOICE_DISABLE_FAILED",
        message: error instanceof Error ? error.message : "克隆音色删除失败",
      },
    };
  }
}
