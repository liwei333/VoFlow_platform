import { Client } from 'minio';
import { Readable } from 'stream';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000', 10);
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'voflow';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'voflow123';
export const MINIO_BUCKET = process.env.MINIO_BUCKET || 'voflow';
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';

let minioClient: Client | null = null;

export function getMinioDiagnostics(error?: unknown) {
  return {
    endpoint: MINIO_ENDPOINT,
    port: MINIO_PORT,
    bucket: MINIO_BUCKET,
    useSSL: MINIO_USE_SSL,
    errorMessage: error instanceof Error ? error.message : String(error ?? ''),
  };
}

export function getMinioClient(): Client {
  if (!minioClient) {
    minioClient = new Client({
      endPoint: MINIO_ENDPOINT,
      port: MINIO_PORT,
      useSSL: MINIO_USE_SSL,
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
    });
  }
  return minioClient;
}

export function buildAssetPath(teamId: string, assetId: string): string {
  return `voflow/${teamId}/assets/${assetId}/raw`;
}

export function buildJobArtifactPath(teamId: string, jobId: string, node: string): string {
  return `voflow/${teamId}/jobs/${jobId}/${node}/`;
}

export async function uploadAsset(
  teamId: string,
  assetId: string,
  fileName: string,
  content: Buffer | Readable,
  contentType: string,
  size: number
): Promise<string> {
  const client = getMinioClient();
  const objectName = `${buildAssetPath(teamId, assetId)}/${fileName}`;

  await client.putObject(MINIO_BUCKET, objectName, content, size, {
    'Content-Type': contentType,
  });

  return objectName;
}

export async function getAsset(teamId: string, assetId: string, fileName: string): Promise<Readable> {
  const client = getMinioClient();
  const objectName = `${buildAssetPath(teamId, assetId)}/${fileName}`;
  const stream = await client.getObject(MINIO_BUCKET, objectName);
  return stream;
}

export async function deleteAsset(teamId: string, assetId: string, fileName: string): Promise<void> {
  const client = getMinioClient();
  const objectName = `${buildAssetPath(teamId, assetId)}/${fileName}`;
  await client.removeObject(MINIO_BUCKET, objectName);
}

export async function uploadJobArtifact(
  teamId: string,
  jobId: string,
  node: string,
  fileName: string,
  content: Buffer | Readable,
  contentType: string,
  size: number
): Promise<string> {
  const client = getMinioClient();
  const objectName = `${buildJobArtifactPath(teamId, jobId, node)}${fileName}`;

  await client.putObject(MINIO_BUCKET, objectName, content, size, {
    'Content-Type': contentType,
  });

  return objectName;
}

export async function getJobArtifact(
  teamId: string,
  jobId: string,
  node: string,
  fileName: string
): Promise<Readable> {
  const client = getMinioClient();
  const objectName = `${buildJobArtifactPath(teamId, jobId, node)}${fileName}`;
  const stream = await client.getObject(MINIO_BUCKET, objectName);
  return stream;
}

export async function getObjectByPath(objectName: string): Promise<Readable> {
  const client = getMinioClient();
  return client.getObject(MINIO_BUCKET, objectName);
}

export async function deleteJobArtifact(
  teamId: string,
  jobId: string,
  node: string,
  fileName: string
): Promise<void> {
  const client = getMinioClient();
  const objectName = `${buildJobArtifactPath(teamId, jobId, node)}${fileName}`;
  await client.removeObject(MINIO_BUCKET, objectName);
}

export async function ensureBucketExists(): Promise<void> {
  const client = getMinioClient();
  const exists = await client.bucketExists(MINIO_BUCKET);
  if (!exists) {
    await client.makeBucket(MINIO_BUCKET);
  }
}

export async function getObjectMetadata(
  teamId: string,
  assetId: string,
  fileName: string
): Promise<Record<string, string>> {
  const client = getMinioClient();
  const objectName = `${buildAssetPath(teamId, assetId)}/${fileName}`;
  const stat = await client.statObject(MINIO_BUCKET, objectName);
  return stat.metaData;
}

export async function listAssets(teamId: string, assetId: string): Promise<string[]> {
  const client = getMinioClient();
  const prefix = `${buildAssetPath(teamId, assetId)}/`;
  const objects: string[] = [];

  const stream = client.listObjects(MINIO_BUCKET, prefix, true);

  return new Promise((resolve, reject) => {
    stream.on('data', (obj: { name: string }) => {
      objects.push(obj.name);
    });
    stream.on('error', reject);
    stream.on('end', () => resolve(objects));
  });
}

export async function generatePresignedUrl(
  teamId: string,
  assetId: string,
  fileName: string,
  expiresInSeconds: number
): Promise<string> {
  const client = getMinioClient();
  const objectName = `${buildAssetPath(teamId, assetId)}/${fileName}`;
  return client.presignedUrl('GET', MINIO_BUCKET, objectName, expiresInSeconds);
}
