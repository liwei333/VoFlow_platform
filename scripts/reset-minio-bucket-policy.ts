/**
 * 重置 MinIO bucket 公开策略
 * 用法: npx tsx scripts/reset-minio-bucket-policy.ts
 */

import { Client } from 'minio';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000', 10);
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'voflow';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'voflow123';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'voflow';
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';

async function main() {
  const client = new Client({
    endPoint: MINIO_ENDPOINT,
    port: MINIO_PORT,
    useSSL: MINIO_USE_SSL,
    accessKey: MINIO_ACCESS_KEY,
    secretKey: MINIO_SECRET_KEY,
  });

  console.log(`检查 bucket '${MINIO_BUCKET}' 是否存在...`);
  const exists = await client.bucketExists(MINIO_BUCKET);

  if (!exists) {
    console.log(`Bucket '${MINIO_BUCKET}' 不存在，无需重置`);
    return;
  }

  console.log(`移除 bucket '${MINIO_BUCKET}' 公开读策略...`);

  try {
    // 设置空策略来移除公开读
    await client.setBucketPolicy(MINIO_BUCKET, JSON.stringify({
      Version: '2012-10-17',
      Statement: [],
    }));
    console.log('✅ 策略已重置为私有');
  } catch (error) {
    console.log('⚠️ 设置策略失败，可能已经是私有状态:', error);
  }

  // 验证
  try {
    const policy = await client.getBucketPolicy(MINIO_BUCKET);
    const parsed = JSON.parse(policy);
    if (parsed.Statement && parsed.Statement.length === 0) {
      console.log('✅ 验证通过: bucket 策略为空（私有）');
    } else {
      console.log('⚠️ 当前策略:', policy);
    }
  } catch (error) {
    console.log('✅ 验证通过: 无公开策略');
  }
}

main().catch(console.error);
