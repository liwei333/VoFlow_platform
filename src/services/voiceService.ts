import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serializeVoices, type SerializedVoice } from "@/lib/tts/serializer";

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
