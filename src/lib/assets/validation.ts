import { AssetType } from '@prisma/client';

// MIME type whitelist per asset type
export const ASSET_MIME_TYPE_WHITELIST: Record<AssetType, string[]> = {
  image: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff',
  ],
  audio: [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/flac',
    'audio/aac',
    'audio/m4a',
    'audio/webm',
  ],
  video: [
    'video/mp4',
    'video/mpeg',
    'video/webm',
    'video/ogg',
    'video/avi',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
  ],
  subtitle: [
    'text/vtt',
    'text/srt',
    'application/x-subrip',
  ],
  bgm: [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/flac',
  ],
  cover: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/bmp',
  ],
  avatar_source: [
    'image/jpeg',
    'image/png',
    'image/webp',
  ],
  artifact: [
    'video/mp4',
    'video/webm',
    'application/json',
  ],
};

// Default size limits in bytes per asset type
export const ASSET_SIZE_LIMITS: Record<AssetType, number> = {
  image: 20 * 1024 * 1024,      // 20MB
  audio: 100 * 1024 * 1024,     // 100MB
  video: 500 * 1024 * 1024,     // 500MB
  subtitle: 1 * 1024 * 1024,    // 1MB
  bgm: 50 * 1024 * 1024,        // 50MB
  cover: 5 * 1024 * 1024,       // 5MB
  avatar_source: 10 * 1024 * 1024, // 10MB
  artifact: 1 * 1024 * 1024 * 1024, // 1GB
};

export type AssetValidationErrorCode =
  | 'UNSUPPORTED_MIME_TYPE'
  | 'FILE_TOO_LARGE'
  | 'EMPTY_FILE'
  | 'INVALID_ASSET_TYPE';

export interface AssetValidationResult {
  valid: boolean;
  errorCode?: AssetValidationErrorCode;
  errorMessage?: string;
}

/**
 * Validate MIME type is allowed for the given asset type
 */
export function isMimeTypeAllowed(mimeType: string, assetType: AssetType): boolean {
  const allowedTypes = ASSET_MIME_TYPE_WHITELIST[assetType];
  if (!allowedTypes) {
    return false;
  }
  return allowedTypes.includes(mimeType.toLowerCase());
}

/**
 * Get the size limit for an asset type in bytes
 */
export function getSizeLimit(assetType: AssetType): number {
  return ASSET_SIZE_LIMITS[assetType] ?? 0;
}

/**
 * Validate an asset file before upload
 */
export function validateAsset(
  mimeType: string,
  sizeBytes: number,
  assetType: AssetType
): AssetValidationResult {
  // Check for empty or invalid file
  if (sizeBytes <= 0) {
    return {
      valid: false,
      errorCode: 'EMPTY_FILE',
      errorMessage: 'File is empty or has invalid size',
    };
  }

  // Check MIME type
  if (!isMimeTypeAllowed(mimeType, assetType)) {
    return {
      valid: false,
      errorCode: 'UNSUPPORTED_MIME_TYPE',
      errorMessage: `MIME type '${mimeType}' is not supported for asset type '${assetType}'`,
    };
  }

  // Check size limit
  const sizeLimit = getSizeLimit(assetType);
  if (sizeLimit > 0 && sizeBytes > sizeLimit) {
    const sizeLimitMB = (sizeLimit / (1024 * 1024)).toFixed(0);
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      errorCode: 'FILE_TOO_LARGE',
      errorMessage: `File size ${sizeMB}MB exceeds limit of ${sizeLimitMB}MB for '${assetType}'`,
    };
  }

  return { valid: true };
}

/**
 * Get all supported MIME types for an asset type
 */
export function getSupportedMimeTypes(assetType: AssetType): string[] {
  return ASSET_MIME_TYPE_WHITELIST[assetType] ?? [];
}

/**
 * Get human-readable size limit for an asset type
 */
export function getSizeLimitDisplay(assetType: AssetType): string {
  const bytes = getSizeLimit(assetType);
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(0)}GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)}KB`;
  }
  return `${bytes}B`;
}
