import type { AvatarPhotoMetadata } from "@/lib/avatar/photo";
import {
  AVATAR_PHOTO_ERROR_CODES,
  AVATAR_PHOTO_ERROR_MESSAGES,
  AVATAR_PHOTO_QUALITY_THRESHOLDS,
} from "@/lib/avatar/constants";

export { AVATAR_PHOTO_ERROR_CODES };

export type AvatarPhotoErrorCode =
  (typeof AVATAR_PHOTO_ERROR_CODES)[keyof typeof AVATAR_PHOTO_ERROR_CODES];

export type AvatarPhotoOcclusion = "none" | "mask" | "sunglasses" | "other";
export type AvatarPhotoExposure = "normal" | "underexposed" | "overexposed";

export type AvatarPhotoDetection = {
  faceCount: number;
  faceBoxRatio?: number;
  confidence?: number;
  yaw?: number;
  pitch?: number;
  roll?: number;
  blurScore?: number;
  occlusion?: AvatarPhotoOcclusion;
  exposure?: AvatarPhotoExposure;
};

type CompleteAvatarPhotoDetection = Required<AvatarPhotoDetection>;

export type AvatarPhotoQualityReason = {
  code: AvatarPhotoErrorCode;
  message: string;
};

export type AvatarPhotoQualityReport = {
  passed: boolean;
  faceCount: number;
  resolution: {
    width: number;
    height: number;
  };
  faceBoxRatio: number;
  confidence: number;
  yaw: number;
  pitch: number;
  roll: number;
  blurScore: number;
  occlusion: AvatarPhotoOcclusion;
  exposure: AvatarPhotoExposure;
  reasons: AvatarPhotoQualityReason[];
};

const DEFAULT_DETECTION: CompleteAvatarPhotoDetection = {
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

export function analyzeAvatarPhotoQuality(
  metadata: AvatarPhotoMetadata,
  detection: AvatarPhotoDetection = DEFAULT_DETECTION
): AvatarPhotoQualityReport {
  const mergedDetection: CompleteAvatarPhotoDetection = {
    ...DEFAULT_DETECTION,
    ...detection,
  };
  const reasons: AvatarPhotoQualityReason[] = [];

  if (!metadata.resolutionPassed) {
    reasons.push(reason(AVATAR_PHOTO_ERROR_CODES.resolutionTooLow));
  }

  if (mergedDetection.faceCount === 0) {
    reasons.push(reason(AVATAR_PHOTO_ERROR_CODES.noFace));
  } else if (mergedDetection.faceCount !== 1) {
    reasons.push(reason(AVATAR_PHOTO_ERROR_CODES.multipleFaces));
  }

  if (
    Math.abs(mergedDetection.yaw) > AVATAR_PHOTO_QUALITY_THRESHOLDS.maxAbsYaw ||
    Math.abs(mergedDetection.pitch) > AVATAR_PHOTO_QUALITY_THRESHOLDS.maxAbsPitch ||
    Math.abs(mergedDetection.roll) > AVATAR_PHOTO_QUALITY_THRESHOLDS.maxAbsRoll
  ) {
    reasons.push(reason(AVATAR_PHOTO_ERROR_CODES.faceAngleInvalid));
  }

  if (mergedDetection.blurScore < AVATAR_PHOTO_QUALITY_THRESHOLDS.minBlurScore) {
    reasons.push(reason(AVATAR_PHOTO_ERROR_CODES.photoBlurry));
  }

  if (mergedDetection.occlusion !== "none") {
    reasons.push(reason(AVATAR_PHOTO_ERROR_CODES.faceOccluded));
  }

  if (mergedDetection.exposure !== "normal") {
    reasons.push(reason(AVATAR_PHOTO_ERROR_CODES.exposureInvalid));
  }

  return {
    passed: reasons.length === 0,
    faceCount: mergedDetection.faceCount,
    resolution: {
      width: metadata.width,
      height: metadata.height,
    },
    faceBoxRatio: mergedDetection.faceBoxRatio,
    confidence: mergedDetection.confidence,
    yaw: mergedDetection.yaw,
    pitch: mergedDetection.pitch,
    roll: mergedDetection.roll,
    blurScore: mergedDetection.blurScore,
    occlusion: mergedDetection.occlusion,
    exposure: mergedDetection.exposure,
    reasons,
  };
}

function reason(code: AvatarPhotoErrorCode): AvatarPhotoQualityReason {
  return {
    code,
    message: AVATAR_PHOTO_ERROR_MESSAGES[code],
  };
}
