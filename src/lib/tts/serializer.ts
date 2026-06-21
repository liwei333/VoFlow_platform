import type { Voice } from "@prisma/client";

export type SerializedVoice = {
  id: string;
  teamId: string | null;
  ownerId: string | null;
  voiceType: string;
  name: string;
  provider: string;
  modelId: string;
  status: string;
  licenseStatus: string;
  sampleUrl: string | null;
  gender: string | null;
  style: string | null;
  language: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
};

export function serializeVoice(voice: Voice): SerializedVoice {
  return {
    id: voice.id,
    teamId: voice.teamId,
    ownerId: voice.ownerId,
    voiceType: voice.voiceType,
    name: voice.name,
    provider: voice.provider,
    modelId: voice.modelId,
    status: voice.status,
    licenseStatus: voice.licenseStatus,
    sampleUrl: voice.sampleUrl,
    gender: voice.gender,
    style: voice.style,
    language: voice.language,
    metadata: voice.metadata,
    createdAt: voice.createdAt.toISOString(),
    updatedAt: voice.updatedAt.toISOString(),
  };
}

export function serializeVoices(voices: Voice[]): SerializedVoice[] {
  return voices.map(serializeVoice);
}
