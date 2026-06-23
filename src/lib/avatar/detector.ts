import type { AvatarPhotoMetadata } from "@/lib/avatar/photo";
import type { AvatarPhotoDetection } from "@/lib/avatar/quality";
import { prisma } from "@/lib/db";

export type AvatarPhotoDetectorProvider = "unavailable" | "mock" | "local";

export type AvatarPhotoDetectorInput = {
  buffer: Buffer;
  fileName: string;
  metadata: AvatarPhotoMetadata;
};

export type AvatarPhotoDetector = {
  detect(input: AvatarPhotoDetectorInput): Promise<AvatarPhotoDetection | undefined>;
};

export type LocalAvatarPhotoDetectorService = {
  baseUrl: string | null;
  status: string;
};

type AvatarPhotoDetectorFetcherResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

type AvatarPhotoDetectorFetcher = (
  url: string,
  init?: RequestInit
) => Promise<AvatarPhotoDetectorFetcherResponse>;

type AvatarPhotoDetectorLogger = {
  warn(message: string, context?: Record<string, unknown>): void;
};

type LocalAvatarPhotoDetectorOptions = {
  findService?: () => Promise<LocalAvatarPhotoDetectorService | null>;
  fetcher?: AvatarPhotoDetectorFetcher;
  logger?: AvatarPhotoDetectorLogger;
  timeoutMs?: number;
};

type AvatarPhotoDetectorOptions = {
  findLocalAvatarService?: () => Promise<LocalAvatarPhotoDetectorService | null>;
  fetcher?: AvatarPhotoDetectorFetcher;
  logger?: AvatarPhotoDetectorLogger;
};

export const unavailableAvatarPhotoDetector: AvatarPhotoDetector = {
  async detect() {
    return undefined;
  },
};

export const mockAvatarPhotoDetector: AvatarPhotoDetector = {
  async detect(input) {
    const scenario = input.fileName.toLowerCase();
    const detection: AvatarPhotoDetection = {
      faceCount: 1,
      faceBoxRatio: 0.42,
      confidence: 0.98,
      yaw: 0,
      pitch: 0,
      roll: 0,
      blurScore: 160,
      occlusion: "none",
      exposure: "normal",
    };

    if (scenario.includes("no-face")) {
      detection.faceCount = 0;
    }

    if (scenario.includes("multiple-faces")) {
      detection.faceCount = 2;
    }

    if (scenario.includes("angle")) {
      detection.yaw = 30;
    }

    if (scenario.includes("blurry")) {
      detection.blurScore = 50;
    }

    if (scenario.includes("occluded")) {
      detection.occlusion = "mask";
    }

    if (scenario.includes("underexposed")) {
      detection.exposure = "underexposed";
    }

    if (scenario.includes("overexposed")) {
      detection.exposure = "overexposed";
    }

    return detection;
  },
};

export type AvatarPhotoDetectorEnv = Record<string, string | undefined> & {
  AVATAR_PHOTO_DETECTOR_PROVIDER?: string;
  AVATAR_PHOTO_DETECTOR_TIMEOUT_MS?: string;
};

const DEFAULT_LOCAL_AVATAR_PHOTO_DETECTOR_TIMEOUT_MS = 5_000;

export function buildAvatarPhotoDetector(
  env: AvatarPhotoDetectorEnv = process.env,
  options: AvatarPhotoDetectorOptions = {}
): AvatarPhotoDetector {
  const provider = readAvatarPhotoDetectorProvider(env);

  if (provider === "mock") {
    return mockAvatarPhotoDetector;
  }

  if (provider === "local") {
    return createLocalAvatarPhotoDetector({
      findService: options.findLocalAvatarService,
      fetcher: options.fetcher,
      logger: options.logger,
      timeoutMs: readAvatarPhotoDetectorTimeoutMs(env),
    });
  }

  return unavailableAvatarPhotoDetector;
}

function readAvatarPhotoDetectorTimeoutMs(env: AvatarPhotoDetectorEnv): number {
  const value = env.AVATAR_PHOTO_DETECTOR_TIMEOUT_MS?.trim();
  if (!value) {
    return DEFAULT_LOCAL_AVATAR_PHOTO_DETECTOR_TIMEOUT_MS;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_LOCAL_AVATAR_PHOTO_DETECTOR_TIMEOUT_MS;
  }

  return parsed;
}

function readAvatarPhotoDetectorProvider(env: AvatarPhotoDetectorEnv): AvatarPhotoDetectorProvider {
  const provider = env.AVATAR_PHOTO_DETECTOR_PROVIDER?.trim();

  if (provider === "mock" || provider === "local") {
    return provider;
  }

  return "unavailable";
}

export async function detectAvatarPhotoContent(
  input: AvatarPhotoDetectorInput,
  detector: AvatarPhotoDetector = buildAvatarPhotoDetector()
) {
  return detector.detect(input);
}

export function createLocalAvatarPhotoDetector(
  options: LocalAvatarPhotoDetectorOptions = {}
): AvatarPhotoDetector {
  const findService = options.findService ?? findLocalAvatarService;
  const fetcher = options.fetcher ?? fetch;
  const logger = options.logger ?? console;
  const timeoutMs = options.timeoutMs ?? DEFAULT_LOCAL_AVATAR_PHOTO_DETECTOR_TIMEOUT_MS;

  return {
    async detect(input) {
      const service = await findService();
      if (!service?.baseUrl || service.status !== "online") {
        logger.warn("Local avatar photo detector unavailable", {
          status: service?.status,
          configured: Boolean(service?.baseUrl),
        });
        return undefined;
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetcher(`${service.baseUrl.replace(/\/$/, "")}/detect-face`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            fileName: input.fileName,
            mimeType: input.metadata.mimeType,
            imageBase64: input.buffer.toString("base64"),
            metadata: input.metadata,
          }),
        }).finally(() => clearTimeout(timeout));

        if (!response.ok) {
          logger.warn("Local avatar photo detector request failed", {
            status: response.status,
          });
          return undefined;
        }

        const payload = await response.json();
        const detection = parseAvatarPhotoDetection(payload);
        if (!detection) {
          logger.warn("Local avatar photo detector response invalid", {
            payload,
          });
          return undefined;
        }

        return detection;
      } catch (error) {
        logger.warn("Local avatar photo detector request failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        return undefined;
      }
    },
  };
}

async function findLocalAvatarService(): Promise<LocalAvatarPhotoDetectorService | null> {
  return prisma.localModelService.findUnique({
    where: { serviceType: "avatar" },
    select: {
      baseUrl: true,
      status: true,
    },
  });
}

function parseAvatarPhotoDetection(payload: unknown): AvatarPhotoDetection | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }

  const value = payload as Record<string, unknown>;
  if (
    !isFiniteNumber(value.faceCount) ||
    !isFiniteNumber(value.yaw) ||
    !isFiniteNumber(value.pitch) ||
    !isFiniteNumber(value.roll) ||
    !isFiniteNumber(value.blurScore) ||
    !isAvatarPhotoOcclusion(value.occlusion) ||
    !isAvatarPhotoExposure(value.exposure)
  ) {
    return undefined;
  }

  const detection: AvatarPhotoDetection = {
    faceCount: value.faceCount,
    yaw: value.yaw,
    pitch: value.pitch,
    roll: value.roll,
    blurScore: value.blurScore,
    occlusion: value.occlusion,
    exposure: value.exposure,
  };

  if (isFiniteNumber(value.faceBoxRatio)) detection.faceBoxRatio = value.faceBoxRatio;
  if (isFiniteNumber(value.confidence)) detection.confidence = value.confidence;

  return detection;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isAvatarPhotoOcclusion(value: unknown): value is NonNullable<AvatarPhotoDetection["occlusion"]> {
  return value === "none" || value === "mask" || value === "sunglasses" || value === "other";
}

function isAvatarPhotoExposure(value: unknown): value is NonNullable<AvatarPhotoDetection["exposure"]> {
  return value === "normal" || value === "underexposed" || value === "overexposed";
}
