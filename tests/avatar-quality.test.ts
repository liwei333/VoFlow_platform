import { describe, expect, it } from "vitest";
import {
  AVATAR_PHOTO_ERROR_CODES,
  analyzeAvatarPhotoQuality,
} from "@/lib/avatar/quality";
import type { AvatarPhotoMetadata } from "@/lib/avatar/photo";

const baseMetadata: AvatarPhotoMetadata = {
  mimeType: "image/png",
  sizeBytes: 5_000,
  width: 1080,
  height: 1440,
  shortSide: 1080,
  minShortSide: 720,
  resolutionPassed: true,
};

describe("avatar photo quality analysis", () => {
  it("returns a passed quality report for one clear frontal face", () => {
    const report = analyzeAvatarPhotoQuality(baseMetadata, {
      faceCount: 1,
      faceBoxRatio: 0.42,
      confidence: 0.98,
      yaw: 2,
      pitch: 1,
      roll: 0,
      blurScore: 180,
      occlusion: "none",
      exposure: "normal",
    });

    expect(report).toMatchObject({
      passed: true,
      faceCount: 1,
      resolution: { width: 1080, height: 1440 },
      faceBoxRatio: 0.42,
      yaw: 2,
      pitch: 1,
      roll: 0,
      blurScore: 180,
      occlusion: "none",
      exposure: "normal",
      reasons: [],
    });
  });

  it("rejects photos without exactly one face", () => {
    expect(analyzeAvatarPhotoQuality(baseMetadata, { faceCount: 0 }).reasons).toEqual([
      {
        code: AVATAR_PHOTO_ERROR_CODES.noFace,
        message: "未检测到人脸，请上传清晰的本人正脸照片",
      },
    ]);

    expect(analyzeAvatarPhotoQuality(baseMetadata, { faceCount: 2 }).reasons).toEqual([
      {
        code: AVATAR_PHOTO_ERROR_CODES.multipleFaces,
        message: "检测到多张人脸，请仅保留本人单人正脸",
      },
    ]);
  });

  it("records angle, blur, occlusion, exposure, and resolution failures", () => {
    const report = analyzeAvatarPhotoQuality(
      {
        ...baseMetadata,
        width: 640,
        height: 960,
        shortSide: 640,
        resolutionPassed: false,
      },
      {
        faceCount: 1,
        yaw: 30,
        pitch: 5,
        roll: 2,
        blurScore: 50,
        occlusion: "sunglasses",
        exposure: "overexposed",
      }
    );

    expect(report.passed).toBe(false);
    expect(report.reasons.map((reason) => reason.code)).toEqual([
      AVATAR_PHOTO_ERROR_CODES.resolutionTooLow,
      AVATAR_PHOTO_ERROR_CODES.faceAngleInvalid,
      AVATAR_PHOTO_ERROR_CODES.photoBlurry,
      AVATAR_PHOTO_ERROR_CODES.faceOccluded,
      AVATAR_PHOTO_ERROR_CODES.exposureInvalid,
    ]);
  });
});
