import { describe, it, expect } from 'vitest';
import {
  validateAsset,
  isMimeTypeAllowed,
  getSizeLimit,
  getSupportedMimeTypes,
  getSizeLimitDisplay,
} from '../src/lib/assets/validation';
import { AssetType } from '@prisma/client';

describe('Asset Validation', () => {
  describe('validateAsset', () => {
    describe('valid files', () => {
      it('should accept valid JPEG image', () => {
        const result = validateAsset('image/jpeg', 1024 * 1024, 'image');
        expect(result.valid).toBe(true);
        expect(result.errorCode).toBeUndefined();
      });

      it('should accept valid PNG image', () => {
        const result = validateAsset('image/png', 5 * 1024 * 1024, 'image');
        expect(result.valid).toBe(true);
      });

      it('should accept valid MP3 audio', () => {
        const result = validateAsset('audio/mpeg', 50 * 1024 * 1024, 'audio');
        expect(result.valid).toBe(true);
      });

      it('should accept valid MP4 video', () => {
        const result = validateAsset('video/mp4', 200 * 1024 * 1024, 'video');
        expect(result.valid).toBe(true);
      });

      it('should accept file at exact size limit', () => {
        const limit = getSizeLimit('image');
        const result = validateAsset('image/jpeg', limit, 'image');
        expect(result.valid).toBe(true);
      });
    });

    describe('unsupported MIME type', () => {
      it('should reject executable file for image type', () => {
        const result = validateAsset('application/x-executable', 1024, 'image');
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('UNSUPPORTED_MIME_TYPE');
      });

      it('should reject PDF for audio type', () => {
        const result = validateAsset('application/pdf', 1024, 'audio');
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('UNSUPPORTED_MIME_TYPE');
      });

      it('should reject DOC for video type', () => {
        const result = validateAsset('application/msword', 1024, 'video');
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('UNSUPPORTED_MIME_TYPE');
      });

      it('should accept image MIME type for cover type', () => {
        // JPEG is valid for cover type
        const result = validateAsset('image/jpeg', 1024, 'cover');
        expect(result.valid).toBe(true);
      });
    });

    describe('file too large', () => {
      it('should reject image exceeding 20MB limit', () => {
        const sizeLimit = getSizeLimit('image');
        const result = validateAsset('image/jpeg', sizeLimit + 1, 'image');
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('FILE_TOO_LARGE');
      });

      it('should reject audio exceeding 100MB limit', () => {
        const sizeLimit = getSizeLimit('audio');
        const result = validateAsset('audio/mpeg', sizeLimit + 1, 'audio');
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('FILE_TOO_LARGE');
      });

      it('should reject video exceeding 500MB limit', () => {
        const sizeLimit = getSizeLimit('video');
        const result = validateAsset('video/mp4', sizeLimit + 1, 'video');
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('FILE_TOO_LARGE');
      });

      it('should reject cover exceeding 5MB limit', () => {
        const sizeLimit = getSizeLimit('cover');
        const result = validateAsset('image/jpeg', sizeLimit + 1, 'cover');
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('FILE_TOO_LARGE');
      });
    });

    describe('empty file', () => {
      it('should reject file with size 0', () => {
        const result = validateAsset('image/jpeg', 0, 'image');
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('EMPTY_FILE');
      });

      it('should reject file with negative size', () => {
        const result = validateAsset('image/jpeg', -1, 'image');
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('EMPTY_FILE');
      });
    });
  });

  describe('isMimeTypeAllowed', () => {
    it('should return true for valid MIME types', () => {
      expect(isMimeTypeAllowed('image/jpeg', 'image')).toBe(true);
      expect(isMimeTypeAllowed('image/png', 'image')).toBe(true);
      expect(isMimeTypeAllowed('audio/mpeg', 'audio')).toBe(true);
      expect(isMimeTypeAllowed('video/mp4', 'video')).toBe(true);
    });

    it('should return false for invalid MIME types', () => {
      expect(isMimeTypeAllowed('application/exe', 'image')).toBe(false);
      expect(isMimeTypeAllowed('text/plain', 'audio')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isMimeTypeAllowed('IMAGE/JPEG', 'image')).toBe(true);
      expect(isMimeTypeAllowed('Audio/MPEG', 'audio')).toBe(true);
    });

    it('should return false for unknown asset type', () => {
      expect(isMimeTypeAllowed('image/jpeg', 'unknown' as AssetType)).toBe(false);
    });
  });

  describe('getSizeLimit', () => {
    it('should return correct limits for each type', () => {
      expect(getSizeLimit('image')).toBe(20 * 1024 * 1024);
      expect(getSizeLimit('audio')).toBe(100 * 1024 * 1024);
      expect(getSizeLimit('video')).toBe(500 * 1024 * 1024);
      expect(getSizeLimit('cover')).toBe(5 * 1024 * 1024);
    });

    it('should return 0 for unknown asset type', () => {
      expect(getSizeLimit('unknown' as AssetType)).toBe(0);
    });
  });

  describe('getSupportedMimeTypes', () => {
    it('should return MIME types for image', () => {
      const types = getSupportedMimeTypes('image');
      expect(types).toContain('image/jpeg');
      expect(types).toContain('image/png');
    });

    it('should return MIME types for audio', () => {
      const types = getSupportedMimeTypes('audio');
      expect(types).toContain('audio/mpeg');
      expect(types).toContain('audio/wav');
    });

    it('should return MIME types for video', () => {
      const types = getSupportedMimeTypes('video');
      expect(types).toContain('video/mp4');
      expect(types).toContain('video/webm');
    });

    it('should return empty array for unknown type', () => {
      const types = getSupportedMimeTypes('unknown' as AssetType);
      expect(types).toEqual([]);
    });
  });

  describe('getSizeLimitDisplay', () => {
    it('should display MB for image', () => {
      expect(getSizeLimitDisplay('image')).toBe('20MB');
    });

    it('should display MB for audio', () => {
      expect(getSizeLimitDisplay('audio')).toBe('100MB');
    });

    it('should display MB for video', () => {
      expect(getSizeLimitDisplay('video')).toBe('500MB');
    });

    it('should display GB for artifact', () => {
      expect(getSizeLimitDisplay('artifact')).toBe('1GB');
    });
  });
});
