import { validateAsset, type AssetValidationResult } from "@/lib/assets/validation";
import {
  AVATAR_PHOTO_MIME_TYPES,
  AVATAR_PHOTO_MIN_SHORT_SIDE_PX,
} from "@/lib/avatar/constants";

export { AVATAR_PHOTO_MIME_TYPES, AVATAR_PHOTO_MIN_SHORT_SIDE_PX };

const PNG_SIGNATURE = 0x89504e47;
const PNG_IHDR_OFFSET = 12;
const JPEG_START_OF_IMAGE = 0xffd8;
const JPEG_SEGMENT_PREFIX = 0xff;
const JPEG_SOF_MARKERS = new Set([
  0xc0,
  0xc1,
  0xc2,
  0xc3,
  0xc5,
  0xc6,
  0xc7,
  0xc9,
  0xca,
  0xcb,
  0xcd,
  0xce,
  0xcf,
]);
const WEBP_CONTAINER = "RIFF";
const WEBP_FORMAT = "WEBP";
const WEBP_EXTENDED = "VP8X";
const WEBP_LOSSLESS = "VP8L";

export type AvatarPhotoMetadata = {
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  shortSide: number;
  minShortSide: number;
  resolutionPassed: boolean;
};

type ImageDimensions = {
  width: number;
  height: number;
};

export function validateAvatarPhotoUpload(
  mimeType: string,
  sizeBytes: number
): AssetValidationResult {
  return validateAsset(mimeType, sizeBytes, "avatar_source");
}

export function parseImageMetadata(
  buffer: Buffer,
  mimeType: string,
  sizeBytes: number
): AvatarPhotoMetadata {
  const { width, height } = readImageDimensions(buffer, mimeType);
  const shortSide = Math.min(width, height);

  return {
    mimeType,
    sizeBytes,
    width,
    height,
    shortSide,
    minShortSide: AVATAR_PHOTO_MIN_SHORT_SIDE_PX,
    resolutionPassed: shortSide >= AVATAR_PHOTO_MIN_SHORT_SIDE_PX,
  };
}

function readImageDimensions(buffer: Buffer, mimeType: string): ImageDimensions {
  switch (mimeType.toLowerCase()) {
    case AVATAR_PHOTO_MIME_TYPES.png:
      return readPngDimensions(buffer);
    case AVATAR_PHOTO_MIME_TYPES.jpeg:
    case AVATAR_PHOTO_MIME_TYPES.jpg:
      return readJpegDimensions(buffer);
    case AVATAR_PHOTO_MIME_TYPES.webp:
      return readWebpDimensions(buffer);
    default:
      throw new Error(`Unsupported avatar photo MIME type: ${mimeType}`);
  }
}

function readPngDimensions(buffer: Buffer): ImageDimensions {
  if (
    buffer.length < 24 ||
    buffer.readUInt32BE(0) !== PNG_SIGNATURE ||
    buffer.toString("ascii", PNG_IHDR_OFFSET, PNG_IHDR_OFFSET + 4) !== "IHDR"
  ) {
    throw new Error("Invalid PNG image data");
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readJpegDimensions(buffer: Buffer): ImageDimensions {
  if (buffer.length < 4 || buffer.readUInt16BE(0) !== JPEG_START_OF_IMAGE) {
    throw new Error("Invalid JPEG image data");
  }

  let offset = 2;
  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== JPEG_SEGMENT_PREFIX) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    offset += 2;

    if (marker === 0xd8 || marker === 0xd9) {
      continue;
    }

    if (offset + 2 > buffer.length) {
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      break;
    }

    if (JPEG_SOF_MARKERS.has(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }

    offset += segmentLength;
  }

  throw new Error("JPEG dimensions not found");
}

function readWebpDimensions(buffer: Buffer): ImageDimensions {
  if (
    buffer.length < 30 ||
    buffer.toString("ascii", 0, 4) !== WEBP_CONTAINER ||
    buffer.toString("ascii", 8, 12) !== WEBP_FORMAT
  ) {
    throw new Error("Invalid WebP image data");
  }

  const chunkType = buffer.toString("ascii", 12, 16);
  if (chunkType === WEBP_EXTENDED) {
    return {
      width: buffer.readUIntLE(24, 3) + 1,
      height: buffer.readUIntLE(27, 3) + 1,
    };
  }

  if (chunkType === WEBP_LOSSLESS && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  throw new Error("Unsupported WebP image data");
}
