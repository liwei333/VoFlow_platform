import { describe, expect, it } from "vitest";
import {
  AVATAR_PHOTO_MIN_SHORT_SIDE_PX,
  parseImageMetadata,
  validateAvatarPhotoUpload,
} from "@/lib/avatar/photo";

function pngBuffer(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  buffer.writeUInt32BE(0x89504e47, 0);
  buffer.writeUInt32BE(0x0d0a1a0a, 4);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function jpegBuffer(width: number, height: number): Buffer {
  return Buffer.from([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x10,
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00,
    0x01,
    0x01,
    0x00,
    0x00,
    0x01,
    0x00,
    0x01,
    0x00,
    0x00,
    0xff,
    0xc0,
    0x00,
    0x08,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x03,
  ]);
}

function webpBuffer(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(30);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(22, 4);
  buffer.write("WEBP", 8, "ascii");
  buffer.write("VP8X", 12, "ascii");
  buffer.writeUInt32LE(10, 16);
  buffer[20] = 0;
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);
  return buffer;
}

describe("avatar photo upload validation", () => {
  it("accepts JPG, PNG, and WebP avatar source uploads through the shared asset rules", () => {
    for (const mimeType of ["image/jpeg", "image/png", "image/webp"]) {
      expect(validateAvatarPhotoUpload(mimeType, 1024).valid).toBe(true);
    }
  });

  it("rejects non-avatar image formats for avatar source uploads", () => {
    const result = validateAvatarPhotoUpload("image/gif", 1024);

    expect(result).toMatchObject({
      valid: false,
      errorCode: "UNSUPPORTED_MIME_TYPE",
    });
  });
});

describe("avatar photo metadata parsing", () => {
  it("parses PNG dimensions and short side from the uploaded bytes", () => {
    const metadata = parseImageMetadata(pngBuffer(1080, 1440), "image/png", 5_000);

    expect(metadata).toEqual({
      mimeType: "image/png",
      sizeBytes: 5_000,
      width: 1080,
      height: 1440,
      shortSide: 1080,
      minShortSide: AVATAR_PHOTO_MIN_SHORT_SIDE_PX,
      resolutionPassed: true,
    });
  });

  it("parses JPEG and WebP dimensions without relying on route code", () => {
    expect(parseImageMetadata(jpegBuffer(720, 1280), "image/jpeg", 8_000)).toMatchObject({
      width: 720,
      height: 1280,
      shortSide: 720,
      resolutionPassed: true,
    });

    expect(parseImageMetadata(webpBuffer(800, 1000), "image/webp", 9_000)).toMatchObject({
      width: 800,
      height: 1000,
      shortSide: 800,
      resolutionPassed: true,
    });
  });

  it("marks photos with a short side below the avatar threshold as not passing resolution", () => {
    const metadata = parseImageMetadata(pngBuffer(640, 960), "image/png", 5_000);

    expect(metadata.shortSide).toBe(640);
    expect(metadata.minShortSide).toBe(AVATAR_PHOTO_MIN_SHORT_SIDE_PX);
    expect(metadata.resolutionPassed).toBe(false);
  });
});
