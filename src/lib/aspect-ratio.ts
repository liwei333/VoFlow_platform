// Aspect ratio mapping between API contract (external) and Prisma enum (internal)

export type ApiAspectRatio = "9:16" | "16:9" | "1:1";
export type PrismaAspectRatio = "ratio_9_16" | "ratio_16_9" | "ratio_1_1";

export const API_TO_PRISMA_MAP: Record<ApiAspectRatio, PrismaAspectRatio> = {
  "9:16": "ratio_9_16",
  "16:9": "ratio_16_9",
  "1:1": "ratio_1_1",
};

export const PRISMA_TO_API_MAP: Record<PrismaAspectRatio, ApiAspectRatio> = {
  ratio_9_16: "9:16",
  ratio_16_9: "16:9",
  ratio_1_1: "1:1",
};

export const VALID_ASPECT_RATIOS: ApiAspectRatio[] = ["9:16", "16:9", "1:1"];

export function toPrismaAspectRatio(api: ApiAspectRatio): PrismaAspectRatio {
  return API_TO_PRISMA_MAP[api];
}

export function toApiAspectRatio(prisma: PrismaAspectRatio): ApiAspectRatio {
  return PRISMA_TO_API_MAP[prisma];
}
