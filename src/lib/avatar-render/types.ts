import type { ApiAspectRatio } from "@/lib/aspect-ratio";
import type { AvatarRenderCrop, AvatarRenderMode } from "@/lib/avatar-render/constants";
import type { Buffer } from "node:buffer";

export type AvatarRenderOptions = {
  crop: AvatarRenderCrop;
  resolution: string;
  background?: "transparent" | "solid" | "source";
};

export type AvatarRenderPayload = {
  requestId: string;
  jobId: string;
  nodeId: string;
  avatarId: string;
  sourceImageUrl: string;
  audioUrl: string;
  sourceImage?: Buffer;
  audio?: Buffer;
  mode: AvatarRenderMode;
  aspectRatio: ApiAspectRatio;
  renderOptions: AvatarRenderOptions;
  traceId: string;
};

export type AvatarRenderResult = {
  provider: string;
  videoPath: string;
  durationMs: number;
  resolution: string;
  model: string;
  providerRequestId?: string;
  metadata: {
    mode: AvatarRenderMode;
    crop: AvatarRenderCrop;
    aspectRatio: ApiAspectRatio;
    contentType: string;
    fileExtension: string;
    [key: string]: unknown;
  };
};

export type LocalAvatarRenderServiceConfig = {
  baseUrl: string | null;
  status: string;
  modelName?: string | null;
};
