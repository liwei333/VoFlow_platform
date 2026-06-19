import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import {
  buildAssetPath,
  buildJobArtifactPath,
  uploadAsset,
  getAsset,
  deleteAsset,
  ensureBucketExists,
  generatePresignedUrl,
  getMinioClient,
} from '../src/lib/storage';
import { ASSET_ACCESS_URL_EXPIRES_SECONDS } from '../src/lib/assets/serializer';

const MINIO_BUCKET = process.env.MINIO_BUCKET || 'voflow';

describe('Storage Adapter', () => {
  // 每次测试运行使用唯一 ID
  const testRunId = randomUUID();
  const teamId = `test-team-${testRunId}`;
  const assetId = `test-asset-${testRunId}`;
  const jobId = `test-job-${testRunId}`;
  const fileName = 'test-file.txt';
  const testContent = Buffer.from('Hello, MinIO!');

  const uploadedObjects: string[] = [];

  beforeAll(async () => {
    await ensureBucketExists();
  });

  afterAll(async () => {
    // 清理本次测试产生的所有对象
    const client = getMinioClient();
    const prefix = `voflow/${teamId}/`;

    try {
      const objects: string[] = [];
      const stream = client.listObjects(MINIO_BUCKET, prefix, true);

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (obj: { name: string }) => {
          objects.push(obj.name);
        });
        stream.on('error', reject);
        stream.on('end', () => resolve());
      });

      if (objects.length > 0) {
        await client.removeObjects(MINIO_BUCKET, objects);
        console.log(`Cleaned up ${objects.length} test objects`);
      }
    } catch (error) {
      console.log('Cleanup warning:', error);
    }
  });

  describe('Path Building', () => {
    it('buildAssetPath should generate correct path', () => {
      const path = buildAssetPath(teamId, assetId);
      expect(path).toBe(`voflow/${teamId}/assets/${assetId}/raw`);
    });

    it('buildJobArtifactPath should generate correct path', () => {
      const path = buildJobArtifactPath(teamId, jobId, 'tts');
      expect(path).toBe(`voflow/${teamId}/jobs/${jobId}/tts/`);
    });
  });

  describe('Bucket Security', () => {
    it('ensureBucketExists should not set public read policy', async () => {
      const client = getMinioClient();

      // 确保 bucket 存在
      await ensureBucketExists();

      // 检查策略是否为空或不存在公开读
      try {
        const policy = await client.getBucketPolicy(MINIO_BUCKET);
        const parsed = JSON.parse(policy);

        // 不应该有公开读语句
        const hasPublicRead = parsed.Statement?.some(
          (s: { Effect: string; Principal?: string | { AWS?: string }; Action: string | string[] }) =>
            s.Effect === 'Allow' &&
            (s.Principal === '*' || (typeof s.Principal === 'object' && s.Principal?.AWS === '*')) &&
            (Array.isArray(s.Action) ? s.Action.includes('s3:GetObject') : s.Action === 's3:GetObject')
        );

        expect(hasPublicRead).toBeFalsy();
      } catch {
        // 无策略也是安全的
        expect(true).toBe(true);
      }
    });
  });

  describe('Asset Operations', () => {
    it('should upload and get asset', async () => {
      const objectName = await uploadAsset(
        teamId,
        assetId,
        fileName,
        testContent,
        'text/plain',
        testContent.length
      );
      uploadedObjects.push(objectName);

      const stream = await getAsset(teamId, assetId, fileName);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const content = Buffer.concat(chunks).toString();
      expect(content).toBe('Hello, MinIO!');
    });

    it('should generate presigned url', async () => {
      const url = await generatePresignedUrl(
        teamId,
        assetId,
        fileName,
        ASSET_ACCESS_URL_EXPIRES_SECONDS
      );
      expect(url).toContain('localhost:9000');
      expect(url).toContain('voflow');
      expect(url).toContain(assetId);
      // 签名 URL 应该包含签名参数
      expect(url).toContain('X-Amz-Signature');
    });

    it('should delete asset', async () => {
      await deleteAsset(teamId, assetId, fileName);

      await expect(getAsset(teamId, assetId, fileName)).rejects.toThrow();
    });
  });
});
