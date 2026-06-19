import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { deleteAsset, getAsset } from "@/lib/storage";

const API_BASE = process.env.API_BASE || "http://localhost:3000";

// Track created assets for cleanup
interface CreatedAsset {
  id: string;
  teamId: string;
  storageUrl: string;
}

const createdAssets: CreatedAsset[] = [];
const createdAuditLogIds: string[] = [];

async function findAssetAuditLog(
  action: "asset_upload" | "asset_delete" | "asset_consent",
  targetId: string
) {
  return prisma.auditLog.findFirst({
    where: {
      action,
      targetType: "asset",
      targetId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

describe("Auth API", () => {
  it("should login successfully with valid credentials", async () => {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "dev@voflow.local",
        password: "dev123456",
      }),
    });

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.code).toBe("SUCCESS");
    expect(data.data.user.email).toBe("dev@voflow.local");
  });

  it("should reject invalid password", async () => {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "dev@voflow.local",
        password: "wrongpassword",
      }),
    });

    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.code).toBe("AUTH_INVALID_CREDENTIALS");
  });

  it("should reject disabled user", async () => {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "disabled@voflow.local",
        password: "disabled123",
      }),
    });

    const data = await response.json();
    expect(response.status).toBe(403);
    expect(data.code).toBe("AUTH_USER_DISABLED");
  });
});

describe("Project API", () => {
  let sessionCookie: string;

  beforeAll(async () => {
    // Login first to get session
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "dev@voflow.local",
        password: "dev123456",
      }),
    });

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      // Extract just the cookie value
      sessionCookie = setCookie.split(";")[0].replace("session=", "");
    }
  });

  it("should return 401 when not logged in", async () => {
    const response = await fetch(`${API_BASE}/api/projects`);
    expect(response.status).toBe(401);
  });

  it("should reject invalid aspect ratio", async () => {
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "dev@voflow.local",
        password: "dev123456",
      }),
    });

    const setCookie = loginResponse.headers.get("set-cookie");
    const cookieValue = setCookie?.split(";")[0] || "";

    const response = await fetch(`${API_BASE}/api/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieValue,
      },
      body: JSON.stringify({
        name: "Test Project",
        targetPlatform: "抖音",
        aspectRatio: "4:3", // Invalid ratio
      }),
    });

    expect(response.status).toBe(400);
  });

  it("should create project with valid aspect ratio", async () => {
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "dev@voflow.local",
        password: "dev123456",
      }),
    });

    const setCookie = loginResponse.headers.get("set-cookie");
    const cookieValue = setCookie?.split(";")[0] || "";

    const projectName = `Test Project ${Date.now()}`;
    const response = await fetch(`${API_BASE}/api/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieValue,
      },
      body: JSON.stringify({
        name: projectName,
        targetPlatform: "抖音",
        aspectRatio: "9:16",
      }),
    });

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.code).toBe("SUCCESS");
    expect(data.data.project.aspectRatio).toBe("9:16");
  });

  it("should list projects filtered by team", async () => {
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "dev@voflow.local",
        password: "dev123456",
      }),
    });

    const setCookie = loginResponse.headers.get("set-cookie");
    const cookieValue = setCookie?.split(";")[0] || "";

    const response = await fetch(`${API_BASE}/api/projects`, {
      headers: {
        Cookie: cookieValue,
      },
    });

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.code).toBe("SUCCESS");
    expect(Array.isArray(data.data.projects)).toBe(true);
  });
});

describe("Health API", () => {
  it("should return health status with dependencies and models", async () => {
    const response = await fetch(`${API_BASE}/api/health`);
    const data = await response.json();

    // Should return 200 or 503 depending on service status
    expect([200, 503]).toContain(response.status);
    expect(data).toHaveProperty("dependencies");
    expect(data).toHaveProperty("models");
    expect(data.dependencies).toHaveProperty("postgres");
    expect(data.dependencies).toHaveProperty("redis");
    expect(data.dependencies).toHaveProperty("minio");
    expect(data.models).toHaveProperty("llm");
    expect(data.models).toHaveProperty("tts");
    expect(data.models).toHaveProperty("asr");
    expect(data.models).toHaveProperty("avatar");
  });
});

// Helper function to get authenticated cookie
async function getAuthCookie(): Promise<string> {
  const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "dev@voflow.local",
      password: "dev123456",
    }),
  });

  const setCookie = loginResponse.headers.get("set-cookie");
  return setCookie?.split(";")[0] || "";
}

// Helper function to create a test file
function createTestFile(content: string, type: string, name: string): File {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

async function readStreamAsString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function createTestAuditLog(options: {
  teamId: string;
  userId: string;
  action: "asset_upload" | "asset_delete" | "asset_consent";
  targetType?: string;
  targetId?: string;
  createdAt?: Date;
}) {
  const auditLog = await prisma.auditLog.create({
    data: {
      teamId: options.teamId,
      userId: options.userId,
      action: options.action,
      targetType: options.targetType ?? "asset",
      targetId: options.targetId ?? `test-audit-${crypto.randomUUID()}`,
      metadata: {
        source: "api-test",
      },
      createdAt: options.createdAt,
    },
  });
  createdAuditLogIds.push(auditLog.id);
  return auditLog;
}

describe("Asset Upload API", () => {
  it("should return 401 when not logged in", async () => {
    const formData = new FormData();
    formData.append("file", createTestFile("test", "text/plain", "test.txt"));
    formData.append("type", "image");

    const response = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      body: formData,
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.code).toBe("UNAUTHORIZED");
  });

  it("should reject invalid MIME type", async () => {
    const cookieValue = await getAuthCookie();

    const formData = new FormData();
    formData.append("file", createTestFile("test content", "text/plain", "test.txt"));
    formData.append("type", "image");

    const response = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: formData,
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(data.errorCode).toBe("UNSUPPORTED_MIME_TYPE");
  });

  it("should reject file exceeding size limit", async () => {
    const cookieValue = await getAuthCookie();

    // Create a large file (21MB for image type, limit is 20MB)
    const largeContent = "x".repeat(21 * 1024 * 1024);
    const formData = new FormData();
    formData.append("file", createTestFile(largeContent, "image/jpeg", "large.jpg"));
    formData.append("type", "image");

    const response = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: formData,
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(data.errorCode).toBe("FILE_TOO_LARGE");
  });

  it("should reject invalid asset type", async () => {
    const cookieValue = await getAuthCookie();

    const formData = new FormData();
    formData.append("file", createTestFile("test", "image/jpeg", "test.jpg"));
    formData.append("type", "invalid_type");

    const response = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: formData,
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(data.errorCode).toBe("INVALID_ASSET_TYPE");
  });

  it("should upload image successfully", async () => {
    const cookieValue = await getAuthCookie();

    const fileContent = "fake image content";
    const formData = new FormData();
    formData.append("file", createTestFile(fileContent, "image/jpeg", "test.jpg"));
    formData.append("type", "image");
    formData.append("name", "Test Image");

    const response = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: formData,
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.code).toBe("SUCCESS");
    expect(data.data.asset).toBeDefined();
    expect(data.data.asset.type).toBe("image");
    expect(data.data.asset.name).toBe("Test Image");
    expect(data.data.asset.mimeType).toBe("image/jpeg");
    expect(data.data.asset.licenseStatus).toBe("pending");

    // Verify storage path format: voflow/{teamId}/assets/{assetId}/raw/{fileName}
    expect(data.data.asset.storageUrl).toMatch(/^voflow\/[^\/]+\/assets\/[^\/]+\/raw\/.+$/);

    const fileName = data.data.asset.fileName;
    const storedAsset = await getAsset(data.data.asset.teamId, data.data.asset.id, fileName);
    await expect(readStreamAsString(storedAsset)).resolves.toBe(fileContent);

    // Track for cleanup
    createdAssets.push({
      id: data.data.asset.id,
      teamId: data.data.asset.teamId,
      storageUrl: data.data.asset.storageUrl,
    });

    const auditLog = await findAssetAuditLog("asset_upload", data.data.asset.id);
    expect(auditLog).toMatchObject({
      teamId: data.data.asset.teamId,
      userId: data.data.asset.ownerId,
      action: "asset_upload",
      targetType: "asset",
      targetId: data.data.asset.id,
      metadata: {
        name: "Test Image",
        type: "image",
      },
    });
  });

  it("should upload audio successfully", async () => {
    const cookieValue = await getAuthCookie();

    const formData = new FormData();
    formData.append("file", createTestFile("fake audio content", "audio/mpeg", "test.mp3"));
    formData.append("type", "audio");

    const response = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: formData,
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.code).toBe("SUCCESS");
    expect(data.data.asset.type).toBe("audio");
    expect(data.data.asset.mimeType).toBe("audio/mpeg");
    expect(data.data.asset.licenseStatus).toBe("pending");
    expect(data.data.asset.storageUrl).toMatch(/^voflow\/[^\/]+\/assets\/[^\/]+\/raw\/.+$/);

    // Track for cleanup
    createdAssets.push({
      id: data.data.asset.id,
      teamId: data.data.asset.teamId,
      storageUrl: data.data.asset.storageUrl,
    });
  });

  it("should upload video successfully", async () => {
    const cookieValue = await getAuthCookie();

    const formData = new FormData();
    formData.append("file", createTestFile("fake video content", "video/mp4", "test.mp4"));
    formData.append("type", "video");

    const response = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: formData,
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.code).toBe("SUCCESS");
    expect(data.data.asset.type).toBe("video");
    expect(data.data.asset.mimeType).toBe("video/mp4");
    expect(data.data.asset.licenseStatus).toBe("pending");
    expect(data.data.asset.storageUrl).toMatch(/^voflow\/[^\/]+\/assets\/[^\/]+\/raw\/.+$/);

    // Track for cleanup
    createdAssets.push({
      id: data.data.asset.id,
      teamId: data.data.asset.teamId,
      storageUrl: data.data.asset.storageUrl,
    });
  });

  it("should reject empty file", async () => {
    const cookieValue = await getAuthCookie();

    const formData = new FormData();
    formData.append("file", createTestFile("", "image/jpeg", "empty.jpg"));
    formData.append("type", "image");

    const response = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: formData,
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(data.errorCode).toBe("EMPTY_FILE");
  });

  it("should reject missing file", async () => {
    const cookieValue = await getAuthCookie();

    const formData = new FormData();
    formData.append("type", "image");

    const response = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: formData,
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(data.errorCode).toBe("EMPTY_FILE");
  });

  it("should reject missing asset type", async () => {
    const cookieValue = await getAuthCookie();

    const formData = new FormData();
    formData.append("file", createTestFile("test", "image/jpeg", "test.jpg"));

    const response = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: formData,
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(data.errorCode).toBe("INVALID_ASSET_TYPE");
  });
});

describe("Asset List API", () => {
  it("should return 401 when not logged in", async () => {
    const response = await fetch(`${API_BASE}/api/assets`);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.code).toBe("UNAUTHORIZED");
  });

  it("should list assets for current team only", async () => {
    const cookieValue = await getAuthCookie();

    // Upload a test asset
    const formData = new FormData();
    formData.append("file", createTestFile("test image", "image/jpeg", "list-test.jpg"));
    formData.append("type", "image");
    formData.append("name", "List Test Image");

    const uploadResponse = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: formData,
    });

    expect(uploadResponse.status).toBe(200);
    const uploadData = await uploadResponse.json();

    // Track for cleanup
    createdAssets.push({
      id: uploadData.data.asset.id,
      teamId: uploadData.data.asset.teamId,
      storageUrl: uploadData.data.asset.storageUrl,
    });

    // List assets
    const listResponse = await fetch(`${API_BASE}/api/assets`, {
      headers: {
        Cookie: cookieValue,
      },
    });

    expect(listResponse.status).toBe(200);
    const listData = await listResponse.json();
    expect(listData.code).toBe("SUCCESS");
    expect(Array.isArray(listData.data.assets)).toBe(true);
    expect(listData.data.pagination).toBeDefined();

    // Verify the uploaded asset is in the list
    const found = listData.data.assets.find((a: any) => a.id === uploadData.data.asset.id);
    expect(found).toBeDefined();
  });

  it("should filter by type", async () => {
    const cookieValue = await getAuthCookie();

    // Upload an image
    const imageFormData = new FormData();
    imageFormData.append("file", createTestFile("image", "image/jpeg", "filter-image.jpg"));
    imageFormData.append("type", "image");

    const imageResponse = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: imageFormData,
    });

    const imageData = await imageResponse.json();
    createdAssets.push({
      id: imageData.data.asset.id,
      teamId: imageData.data.asset.teamId,
      storageUrl: imageData.data.asset.storageUrl,
    });

    // Upload a video
    const videoFormData = new FormData();
    videoFormData.append("file", createTestFile("video", "video/mp4", "filter-video.mp4"));
    videoFormData.append("type", "video");

    const videoResponse = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: videoFormData,
    });

    const videoData = await videoResponse.json();
    createdAssets.push({
      id: videoData.data.asset.id,
      teamId: videoData.data.asset.teamId,
      storageUrl: videoData.data.asset.storageUrl,
    });

    // Filter by type=image
    const filterResponse = await fetch(`${API_BASE}/api/assets?type=image`, {
      headers: {
        Cookie: cookieValue,
      },
    });

    expect(filterResponse.status).toBe(200);
    const filterData = await filterResponse.json();
    expect(filterData.code).toBe("SUCCESS");

    // All returned assets should be of type image
    filterData.data.assets.forEach((asset: any) => {
      expect(asset.type).toBe("image");
    });
  });

  it("should filter by licenseStatus", async () => {
    const cookieValue = await getAuthCookie();

    // Upload an asset (default licenseStatus is pending)
    const formData = new FormData();
    formData.append("file", createTestFile("test", "image/jpeg", "license-test.jpg"));
    formData.append("type", "image");

    const uploadResponse = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: formData,
    });

    const uploadData = await uploadResponse.json();
    createdAssets.push({
      id: uploadData.data.asset.id,
      teamId: uploadData.data.asset.teamId,
      storageUrl: uploadData.data.asset.storageUrl,
    });

    // Filter by licenseStatus=pending
    const filterResponse = await fetch(`${API_BASE}/api/assets?licenseStatus=pending`, {
      headers: {
        Cookie: cookieValue,
      },
    });

    expect(filterResponse.status).toBe(200);
    const filterData = await filterResponse.json();
    expect(filterData.code).toBe("SUCCESS");

    // All returned assets should have licenseStatus=pending
    filterData.data.assets.forEach((asset: any) => {
      expect(asset.licenseStatus).toBe("pending");
    });
  });

  it("should not return deleted assets", async () => {
    const cookieValue = await getAuthCookie();

    // Upload an asset
    const formData = new FormData();
    formData.append("file", createTestFile("test", "image/jpeg", "delete-test.jpg"));
    formData.append("type", "image");

    const uploadResponse = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: formData,
    });

    const uploadData = await uploadResponse.json();
    const assetId = uploadData.data.asset.id;
    const teamId = uploadData.data.asset.teamId;
    const storageUrl = uploadData.data.asset.storageUrl;

    try {
      // Soft delete the asset
      await prisma.asset.update({
        where: { id: assetId },
        data: { deletedAt: new Date() },
      });

      // List assets
      const listResponse = await fetch(`${API_BASE}/api/assets`, {
        headers: {
          Cookie: cookieValue,
        },
      });

      const listData = await listResponse.json();

      // The deleted asset should not be in the list
      const found = listData.data.assets.find((a: any) => a.id === assetId);
      expect(found).toBeUndefined();
    } finally {
      // Clean up: delete MinIO object
      const fileName = storageUrl.split("/").pop() || "";
      try {
        await deleteAsset(teamId, assetId, fileName);
        console.log(`Deleted MinIO object: ${storageUrl}`);
      } catch (error) {
        console.warn(`Failed to delete MinIO object ${storageUrl}:`, error);
      }

      // Clean up: permanently delete the soft-deleted asset
      try {
        await prisma.asset.delete({
          where: { id: assetId },
        });
        console.log(`Deleted asset record: ${assetId}`);
      } catch (error) {
        // Record may already be deleted, ignore
        console.warn(`Failed to delete asset record ${assetId}:`, error);
      }
    }
  });

  it("should return sizeBytes as string", async () => {
    const cookieValue = await getAuthCookie();

    // Upload an asset
    const formData = new FormData();
    formData.append("file", createTestFile("test", "image/jpeg", "size-test.jpg"));
    formData.append("type", "image");

    const uploadResponse = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: formData,
    });

    const uploadData = await uploadResponse.json();
    createdAssets.push({
      id: uploadData.data.asset.id,
      teamId: uploadData.data.asset.teamId,
      storageUrl: uploadData.data.asset.storageUrl,
    });

    // List assets
    const listResponse = await fetch(`${API_BASE}/api/assets`, {
      headers: {
        Cookie: cookieValue,
      },
    });

    const listData = await listResponse.json();

    // Find the uploaded asset
    const found = listData.data.assets.find((a: any) => a.id === uploadData.data.asset.id);
    expect(found).toBeDefined();
    expect(typeof found.sizeBytes).toBe("string");
  });

  it("should return accessUrl with presigned URL", async () => {
    const cookieValue = await getAuthCookie();

    // Upload an asset
    const formData = new FormData();
    formData.append("file", createTestFile("test", "image/jpeg", "access-url-test.jpg"));
    formData.append("type", "image");

    const uploadResponse = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: formData,
    });

    const uploadData = await uploadResponse.json();
    createdAssets.push({
      id: uploadData.data.asset.id,
      teamId: uploadData.data.asset.teamId,
      storageUrl: uploadData.data.asset.storageUrl,
    });

    // List assets
    const listResponse = await fetch(`${API_BASE}/api/assets`, {
      headers: {
        Cookie: cookieValue,
      },
    });

    const listData = await listResponse.json();

    // Find the uploaded asset
    const found = listData.data.assets.find((a: any) => a.id === uploadData.data.asset.id);
    expect(found).toBeDefined();
    expect(found.accessUrl).toBeDefined();
    expect(found.accessUrl).toContain("X-Amz-Signature"); // Presigned URL signature
  });
});

describe("Asset Detail API", () => {
  it("should return 401 when not logged in", async () => {
    const response = await fetch(`${API_BASE}/api/assets/non-existent-id`);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.code).toBe("UNAUTHORIZED");
  });

  it("should return asset details", async () => {
    const cookieValue = await getAuthCookie();

    // Upload an asset
    const formData = new FormData();
    formData.append("file", createTestFile("test", "image/jpeg", "detail-test.jpg"));
    formData.append("type", "image");
    formData.append("name", "Detail Test Image");

    const uploadResponse = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: formData,
    });

    const uploadData = await uploadResponse.json();
    const assetId = uploadData.data.asset.id;

    createdAssets.push({
      id: assetId,
      teamId: uploadData.data.asset.teamId,
      storageUrl: uploadData.data.asset.storageUrl,
    });

    // Get asset details
    const detailResponse = await fetch(`${API_BASE}/api/assets/${assetId}`, {
      headers: {
        Cookie: cookieValue,
      },
    });

    expect(detailResponse.status).toBe(200);
    const detailData = await detailResponse.json();
    expect(detailData.code).toBe("SUCCESS");
    expect(detailData.data.asset.id).toBe(assetId);
    expect(detailData.data.asset.name).toBe("Detail Test Image");
    expect(detailData.data.asset.type).toBe("image");
    expect(detailData.data.asset.mimeType).toBe("image/jpeg");
    expect(detailData.data.asset.licenseStatus).toBe("pending");
  });

  it("should return 404 for non-existent asset", async () => {
    const cookieValue = await getAuthCookie();

    const response = await fetch(`${API_BASE}/api/assets/non-existent-asset-id`, {
      headers: {
        Cookie: cookieValue,
      },
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.code).toBe("NOT_FOUND");
  });

  it("should not return assets from other teams", async () => {
    const cookieValue = await getAuthCookie();

    // Get current user info
    const meResponse = await fetch(`${API_BASE}/api/me`, {
      headers: {
        Cookie: cookieValue,
      },
    });
    const meData = await meResponse.json();
    const userId = meData.data.user.id;

    // Create an asset in a different team (using current user as owner to satisfy FK constraint)
    const otherTeamAsset = await prisma.asset.create({
      data: {
        teamId: "other-team-id",
        ownerId: userId, // Use existing user to satisfy FK constraint
        type: "image",
        name: "Other Team Asset",
        storageUrl: "voflow/other-team-id/assets/test-id/raw/test.jpg",
        mimeType: "image/jpeg",
        sizeBytes: BigInt(1000),
        licenseStatus: "pending",
      },
    });

    // Try to access the other team's asset
    const response = await fetch(`${API_BASE}/api/assets/${otherTeamAsset.id}`, {
      headers: {
        Cookie: cookieValue,
      },
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.code).toBe("NOT_FOUND");

    // Clean up
    await prisma.asset.delete({
      where: { id: otherTeamAsset.id },
    });
  });

  it("should return sizeBytes as string", async () => {
    const cookieValue = await getAuthCookie();

    // Upload an asset
    const formData = new FormData();
    formData.append("file", createTestFile("test", "image/jpeg", "detail-size-test.jpg"));
    formData.append("type", "image");

    const uploadResponse = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: formData,
    });

    const uploadData = await uploadResponse.json();
    const assetId = uploadData.data.asset.id;

    createdAssets.push({
      id: assetId,
      teamId: uploadData.data.asset.teamId,
      storageUrl: uploadData.data.asset.storageUrl,
    });

    // Get asset details
    const detailResponse = await fetch(`${API_BASE}/api/assets/${assetId}`, {
      headers: {
        Cookie: cookieValue,
      },
    });

    const detailData = await detailResponse.json();
    expect(typeof detailData.data.asset.sizeBytes).toBe("string");
  });

  it("should return accessUrl with presigned URL", async () => {
    const cookieValue = await getAuthCookie();

    // Upload an asset
    const formData = new FormData();
    formData.append("file", createTestFile("test", "image/jpeg", "detail-access-test.jpg"));
    formData.append("type", "image");

    const uploadResponse = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: formData,
    });

    const uploadData = await uploadResponse.json();
    const assetId = uploadData.data.asset.id;

    createdAssets.push({
      id: assetId,
      teamId: uploadData.data.asset.teamId,
      storageUrl: uploadData.data.asset.storageUrl,
    });

    // Get asset details
    const detailResponse = await fetch(`${API_BASE}/api/assets/${assetId}`, {
      headers: {
        Cookie: cookieValue,
      },
    });

    const detailData = await detailResponse.json();
    expect(detailData.data.asset.accessUrl).toBeDefined();
    expect(detailData.data.asset.accessUrl).toContain("X-Amz-Signature"); // Presigned URL signature
  });

  it("should return 404 for soft-deleted asset", async () => {
    const cookieValue = await getAuthCookie();

    // Upload an asset with unique filename
    const uniqueFileName = `detail-soft-delete-${Date.now()}.jpg`;
    const formData = new FormData();
    formData.append("file", createTestFile("test", "image/jpeg", uniqueFileName));
    formData.append("type", "image");
    formData.append("name", "Soft Delete Test");

    const uploadResponse = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: formData,
    });

    const uploadData = await uploadResponse.json();
    const assetId = uploadData.data.asset.id;
    const teamId = uploadData.data.asset.teamId;
    const storageUrl = uploadData.data.asset.storageUrl;

    try {
      // Soft delete the asset
      await prisma.asset.update({
        where: { id: assetId },
        data: { deletedAt: new Date() },
      });

      // Try to get asset details
      const detailResponse = await fetch(`${API_BASE}/api/assets/${assetId}`, {
        headers: {
          Cookie: cookieValue,
        },
      });

      // Should return 404
      expect(detailResponse.status).toBe(404);
      const detailData = await detailResponse.json();
      expect(detailData.code).toBe("NOT_FOUND");
    } finally {
      // Clean up: delete MinIO object
      const fileName = storageUrl.split("/").pop() || "";
      try {
        await deleteAsset(teamId, assetId, fileName);
        console.log(`Deleted MinIO object: ${storageUrl}`);
      } catch (error) {
        console.warn(`Failed to delete MinIO object ${storageUrl}:`, error);
      }

      // Clean up: delete DB record
      try {
        await prisma.asset.delete({
          where: { id: assetId },
        });
        console.log(`Deleted asset record: ${assetId}`);
      } catch (error) {
        // Record may already be deleted, ignore
        console.warn(`Failed to delete asset record ${assetId}:`, error);
      }
    }
  });
});

describe("Asset Delete API", () => {
  it("should return 401 when not logged in", async () => {
    const response = await fetch(`${API_BASE}/api/assets/non-existent-id`, {
      method: "DELETE",
    });
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.code).toBe("UNAUTHORIZED");
  });

  it("should soft delete an asset successfully", async () => {
    const cookieValue = await getAuthCookie();
    let assetId = "";
    let teamId = "";
    let storageUrl = "";

    try {
      // Upload an asset
      const formData = new FormData();
      formData.append(
        "file",
        createTestFile("test", "image/jpeg", `delete-api-${crypto.randomUUID()}.jpg`)
      );
      formData.append("type", "image");
      formData.append("name", "Soft Delete Test Asset");

      const uploadResponse = await fetch(`${API_BASE}/api/assets/upload`, {
        method: "POST",
        headers: {
          Cookie: cookieValue,
        },
        body: formData,
      });

      expect(uploadResponse.status).toBe(200);
      const uploadData = await uploadResponse.json();
      assetId = uploadData.data.asset.id;
      teamId = uploadData.data.asset.teamId;
      storageUrl = uploadData.data.asset.storageUrl;

      // Delete the asset
      const deleteResponse = await fetch(`${API_BASE}/api/assets/${assetId}`, {
        method: "DELETE",
        headers: {
          Cookie: cookieValue,
        },
      });

      expect(deleteResponse.status).toBe(200);
      const deleteData = await deleteResponse.json();
      expect(deleteData.code).toBe("SUCCESS");

      // Verify database record is soft deleted but still traceable.
      const deletedAsset = await prisma.asset.findUnique({
        where: { id: assetId },
        select: { deletedAt: true },
      });
      expect(deletedAsset?.deletedAt).toBeInstanceOf(Date);

      const auditLog = await findAssetAuditLog("asset_delete", assetId);
      expect(auditLog).toMatchObject({
        teamId,
        action: "asset_delete",
        targetType: "asset",
        targetId: assetId,
        metadata: {
          deletedAt: deletedAsset?.deletedAt?.toISOString(),
        },
      });

      // Detail API should hide soft-deleted assets.
      const detailResponse = await fetch(`${API_BASE}/api/assets/${assetId}`, {
        headers: {
          Cookie: cookieValue,
        },
      });
      expect(detailResponse.status).toBe(404);
      const detailData = await detailResponse.json();
      expect(detailData.code).toBe("NOT_FOUND");

      // Verify asset is not in list.
      const listResponse = await fetch(`${API_BASE}/api/assets`, {
        headers: {
          Cookie: cookieValue,
        },
      });
      const listData = await listResponse.json();
      const found = listData.data.assets.find((a: any) => a.id === assetId);
      expect(found).toBeUndefined();

      // Repeated delete should keep resource invisible.
      const secondDeleteResponse = await fetch(`${API_BASE}/api/assets/${assetId}`, {
        method: "DELETE",
        headers: {
          Cookie: cookieValue,
        },
      });
      expect(secondDeleteResponse.status).toBe(404);
      const secondDeleteData = await secondDeleteResponse.json();
      expect(secondDeleteData.code).toBe("NOT_FOUND");
    } finally {
      if (storageUrl && teamId && assetId) {
        const fileName = storageUrl.split("/").pop() || "";
        try {
          await deleteAsset(teamId, assetId, fileName);
        } catch (error) {
          console.warn(`Failed to delete MinIO object:`, error);
        }
      }

      if (assetId) {
        try {
          await prisma.auditLog.deleteMany({
            where: {
              targetType: "asset",
              targetId: assetId,
            },
          });
        } catch (error) {
          console.warn(`Failed to delete audit logs:`, error);
        }

        try {
          await prisma.asset.delete({
            where: { id: assetId },
          });
        } catch (error) {
          console.warn(`Failed to delete asset record:`, error);
        }
      }
    }
  });

  it("should return 404 for non-existent asset", async () => {
    const cookieValue = await getAuthCookie();

    const response = await fetch(`${API_BASE}/api/assets/non-existent-asset-id`, {
      method: "DELETE",
      headers: {
        Cookie: cookieValue,
      },
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.code).toBe("NOT_FOUND");
  });

  it("should return 404 for already deleted asset", async () => {
    const cookieValue = await getAuthCookie();
    let assetId = "";
    let teamId = "";
    let storageUrl = "";

    try {
      // Upload an asset
      const formData = new FormData();
      formData.append(
        "file",
        createTestFile("test", "image/jpeg", `delete-api-already-${crypto.randomUUID()}.jpg`)
      );
      formData.append("type", "image");

      const uploadResponse = await fetch(`${API_BASE}/api/assets/upload`, {
        method: "POST",
        headers: {
          Cookie: cookieValue,
        },
        body: formData,
      });

      expect(uploadResponse.status).toBe(200);
      const uploadData = await uploadResponse.json();
      assetId = uploadData.data.asset.id;
      teamId = uploadData.data.asset.teamId;
      storageUrl = uploadData.data.asset.storageUrl;

      // Soft delete via DB directly
      await prisma.asset.update({
        where: { id: assetId },
        data: { deletedAt: new Date() },
      });

      // Try to delete again via API
      const deleteResponse = await fetch(`${API_BASE}/api/assets/${assetId}`, {
        method: "DELETE",
        headers: {
          Cookie: cookieValue,
        },
      });

      expect(deleteResponse.status).toBe(404);
      const deleteData = await deleteResponse.json();
      expect(deleteData.code).toBe("NOT_FOUND");
    } finally {
      if (storageUrl && teamId && assetId) {
        const fileName = storageUrl.split("/").pop() || "";
        try {
          await deleteAsset(teamId, assetId, fileName);
        } catch (error) {
          console.warn(`Failed to delete MinIO object:`, error);
        }
      }

      if (assetId) {
        try {
          await prisma.asset.delete({
            where: { id: assetId },
          });
        } catch (error) {
          console.warn(`Failed to delete asset record:`, error);
        }
      }
    }
  });

  it("should return 404 for asset from other team", async () => {
    const cookieValue = await getAuthCookie();
    let otherTeamAssetId = "";

    try {
      // Get current user info
      const meResponse = await fetch(`${API_BASE}/api/me`, {
        headers: {
          Cookie: cookieValue,
        },
      });
      const meData = await meResponse.json();
      const userId = meData.data.user.id;

      // Create an asset in a different team
      const otherTeamAsset = await prisma.asset.create({
        data: {
          teamId: "other-team-id",
          ownerId: userId,
          type: "image",
          name: "Other Team Asset",
          storageUrl: "voflow/other-team-id/assets/test-id/raw/test.jpg",
          mimeType: "image/jpeg",
          sizeBytes: BigInt(1000),
          licenseStatus: "pending",
        },
      });
      otherTeamAssetId = otherTeamAsset.id;

      // Try to delete the other team's asset
      const deleteResponse = await fetch(`${API_BASE}/api/assets/${otherTeamAssetId}`, {
        method: "DELETE",
        headers: {
          Cookie: cookieValue,
        },
      });

      expect(deleteResponse.status).toBe(404);
      const deleteData = await deleteResponse.json();
      expect(deleteData.code).toBe("NOT_FOUND");
    } finally {
      if (otherTeamAssetId) {
        try {
          await prisma.asset.delete({
            where: { id: otherTeamAssetId },
          });
        } catch (error) {
          console.warn(`Failed to delete other team asset record:`, error);
        }
      }
    }
  });
});

describe("Asset Consent API", () => {
  it("should return 401 when not logged in", async () => {
    const response = await fetch(`${API_BASE}/api/assets/non-existent-id/consents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consentText: "I confirm I have usage rights for this asset.",
        usageScope: ["video_generation"],
      }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.code).toBe("UNAUTHORIZED");
  });

  it("should reject invalid consent payload", async () => {
    const cookieValue = await getAuthCookie();

    const response = await fetch(`${API_BASE}/api/assets/non-existent-id/consents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieValue,
      },
      body: JSON.stringify({
        consentText: "",
        usageScope: [],
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(data.errors)).toBe(true);
  });

  it("should create consent and approve asset", async () => {
    const cookieValue = await getAuthCookie();

    const formData = new FormData();
    formData.append(
      "file",
      createTestFile("test", "image/jpeg", `consent-api-${crypto.randomUUID()}.jpg`)
    );
    formData.append("type", "image");
    formData.append("name", "Consent Test Asset");

    const uploadResponse = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: formData,
    });

    expect(uploadResponse.status).toBe(200);
    const uploadData = await uploadResponse.json();
    const assetId = uploadData.data.asset.id;

    createdAssets.push({
      id: assetId,
      teamId: uploadData.data.asset.teamId,
      storageUrl: uploadData.data.asset.storageUrl,
    });

    const consentText = "I confirm this asset is licensed for generated videos.";
    const consentResponse = await fetch(`${API_BASE}/api/assets/${assetId}/consents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieValue,
        "x-forwarded-for": "203.0.113.10",
      },
      body: JSON.stringify({
        consentText,
        usageScope: ["video_generation", "publishing"],
        deviceJson: {
          userAgent: "vitest",
        },
      }),
    });

    expect(consentResponse.status).toBe(200);
    const consentData = await consentResponse.json();
    expect(consentData.code).toBe("SUCCESS");
    expect(consentData.data.asset.licenseStatus).toBe("approved");
    expect(consentData.data.consent.assetId).toBe(assetId);
    expect(consentData.data.consent.consentText).toBe(consentText);
    expect(consentData.data.consent.usageScope).toEqual(["video_generation", "publishing"]);

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { licenseStatus: true },
    });
    expect(asset?.licenseStatus).toBe("approved");

    const consent = await prisma.assetConsent.findFirst({
      where: { assetId },
      orderBy: { createdAt: "desc" },
    });
    expect(consent?.consentText).toBe(consentText);
    expect(consent?.usageScope).toEqual(["video_generation", "publishing"]);
    expect(consent?.ipAddress).toBe("203.0.113.10");
    expect(consent?.device).toEqual({ userAgent: "vitest" });

    const auditLog = await findAssetAuditLog("asset_consent", assetId);
    expect(auditLog).toMatchObject({
      teamId: uploadData.data.asset.teamId,
      action: "asset_consent",
      targetType: "asset",
      targetId: assetId,
      metadata: {
        consentId: consentData.data.consent.id,
        consentType: "asset_license",
        usageScope: ["video_generation", "publishing"],
      },
    });
  });

  it("should return 404 for non-existent asset", async () => {
    const cookieValue = await getAuthCookie();

    const response = await fetch(`${API_BASE}/api/assets/non-existent-asset-id/consents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieValue,
      },
      body: JSON.stringify({
        consentText: "I confirm I have usage rights for this asset.",
        usageScope: ["video_generation"],
      }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.code).toBe("NOT_FOUND");
  });

  it("should return 404 for soft-deleted asset", async () => {
    const cookieValue = await getAuthCookie();

    const formData = new FormData();
    formData.append(
      "file",
      createTestFile("test", "image/jpeg", `consent-deleted-${crypto.randomUUID()}.jpg`)
    );
    formData.append("type", "image");

    const uploadResponse = await fetch(`${API_BASE}/api/assets/upload`, {
      method: "POST",
      headers: {
        Cookie: cookieValue,
      },
      body: formData,
    });

    expect(uploadResponse.status).toBe(200);
    const uploadData = await uploadResponse.json();
    const assetId = uploadData.data.asset.id;

    createdAssets.push({
      id: assetId,
      teamId: uploadData.data.asset.teamId,
      storageUrl: uploadData.data.asset.storageUrl,
    });

    await prisma.asset.update({
      where: { id: assetId },
      data: { deletedAt: new Date() },
    });

    const response = await fetch(`${API_BASE}/api/assets/${assetId}/consents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieValue,
      },
      body: JSON.stringify({
        consentText: "I confirm I have usage rights for this asset.",
        usageScope: ["video_generation"],
      }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.code).toBe("NOT_FOUND");
  });

  it("should return 404 for asset from other team", async () => {
    const cookieValue = await getAuthCookie();
    let otherTeamAssetId = "";

    try {
      const meResponse = await fetch(`${API_BASE}/api/me`, {
        headers: {
          Cookie: cookieValue,
        },
      });
      const meData = await meResponse.json();
      const userId = meData.data.user.id;

      const otherTeamAsset = await prisma.asset.create({
        data: {
          teamId: "other-team-id",
          ownerId: userId,
          type: "image",
          name: "Other Team Consent Asset",
          storageUrl: "voflow/other-team-id/assets/test-id/raw/test.jpg",
          mimeType: "image/jpeg",
          sizeBytes: BigInt(1000),
          licenseStatus: "pending",
        },
      });
      otherTeamAssetId = otherTeamAsset.id;

      const response = await fetch(`${API_BASE}/api/assets/${otherTeamAssetId}/consents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieValue,
        },
        body: JSON.stringify({
          consentText: "I confirm I have usage rights for this asset.",
          usageScope: ["video_generation"],
        }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.code).toBe("NOT_FOUND");
    } finally {
      if (otherTeamAssetId) {
        try {
          await prisma.asset.delete({
            where: { id: otherTeamAssetId },
          });
        } catch (error) {
          console.warn(`Failed to delete other team asset record:`, error);
        }
      }
    }
  });
});

describe("Audit Log API", () => {
  it("should return 401 when not logged in", async () => {
    const response = await fetch(`${API_BASE}/api/audit-logs`);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.code).toBe("UNAUTHORIZED");
  });

  it("should list only current team audit logs with pagination", async () => {
    const cookieValue = await getAuthCookie();
    const user = await prisma.user.findUnique({
      where: { email: "dev@voflow.local" },
      include: { teamMemberships: true },
    });
    const teamId = user?.teamMemberships[0]?.teamId;
    if (!user || !teamId) {
      throw new Error("dev user seed data is required for audit log API tests");
    }

    const currentTeamLog = await createTestAuditLog({
      teamId,
      userId: user.id,
      action: "asset_upload",
      targetType: "audit_api",
      targetId: `audit-current-${crypto.randomUUID()}`,
      createdAt: new Date("2026-06-18T08:00:00.000Z"),
    });
    const secondCurrentTeamLog = await createTestAuditLog({
      teamId,
      userId: user.id,
      action: "asset_delete",
      targetType: "audit_api",
      targetId: `audit-current-${crypto.randomUUID()}`,
      createdAt: new Date("2026-06-18T09:00:00.000Z"),
    });
    const otherTeamLog = await createTestAuditLog({
      teamId: `other-team-${crypto.randomUUID()}`,
      userId: user.id,
      action: "asset_upload",
      targetType: "audit_api",
      targetId: `audit-other-${crypto.randomUUID()}`,
      createdAt: new Date("2026-06-18T10:00:00.000Z"),
    });

    const response = await fetch(`${API_BASE}/api/audit-logs?page=1&pageSize=2&target_type=audit_api`, {
      headers: {
        Cookie: cookieValue,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.code).toBe("SUCCESS");
    expect(data.data.auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: currentTeamLog.id,
          teamId,
          userId: user.id,
          action: "asset_upload",
          targetType: "audit_api",
          targetId: currentTeamLog.targetId,
          createdAt: currentTeamLog.createdAt.toISOString(),
        }),
        expect.objectContaining({
          id: secondCurrentTeamLog.id,
          teamId,
          action: "asset_delete",
          targetType: "audit_api",
          targetId: secondCurrentTeamLog.targetId,
        }),
      ])
    );
    expect(data.data.auditLogs.map((log: any) => log.id)).not.toContain(otherTeamLog.id);
    expect(data.data.pagination).toMatchObject({
      page: 1,
      pageSize: 2,
    });
    expect(data.data.pagination.total).toBeGreaterThanOrEqual(2);
  });

  it("should filter audit logs by action target_type and created_at range", async () => {
    const cookieValue = await getAuthCookie();
    const user = await prisma.user.findUnique({
      where: { email: "dev@voflow.local" },
      include: { teamMemberships: true },
    });
    const teamId = user?.teamMemberships[0]?.teamId;
    if (!user || !teamId) {
      throw new Error("dev user seed data is required for audit log API tests");
    }

    const matchedLog = await createTestAuditLog({
      teamId,
      userId: user.id,
      action: "asset_consent",
      targetType: "asset",
      targetId: `audit-filter-${crypto.randomUUID()}`,
      createdAt: new Date("2026-06-17T12:00:00.000Z"),
    });
    const actionMismatchLog = await createTestAuditLog({
      teamId,
      userId: user.id,
      action: "asset_upload",
      targetType: "asset",
      targetId: `audit-filter-${crypto.randomUUID()}`,
      createdAt: new Date("2026-06-17T12:00:00.000Z"),
    });
    const dateMismatchLog = await createTestAuditLog({
      teamId,
      userId: user.id,
      action: "asset_consent",
      targetType: "asset",
      targetId: `audit-filter-${crypto.randomUUID()}`,
      createdAt: new Date("2026-06-10T12:00:00.000Z"),
    });

    const params = new URLSearchParams({
      action: "asset_consent",
      target_type: "asset",
      created_at_from: "2026-06-17T00:00:00.000Z",
      created_at_to: "2026-06-18T00:00:00.000Z",
      pageSize: "20",
    });

    const response = await fetch(`${API_BASE}/api/audit-logs?${params}`, {
      headers: {
        Cookie: cookieValue,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    const ids = data.data.auditLogs.map((log: any) => log.id);
    expect(ids).toContain(matchedLog.id);
    expect(ids).not.toContain(actionMismatchLog.id);
    expect(ids).not.toContain(dateMismatchLog.id);
  });

  it("should reject invalid audit log filters", async () => {
    const cookieValue = await getAuthCookie();

    const response = await fetch(`${API_BASE}/api/audit-logs?action=invalid_action`, {
      headers: {
        Cookie: cookieValue,
      },
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(data.errors)).toBe(true);
  });
});

// Cleanup test-created assets after all tests
afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: {
      id: { in: createdAuditLogIds },
    },
  });

  for (const asset of createdAssets) {
    // Extract filename from storageUrl (format: voflow/{teamId}/assets/{assetId}/raw/{fileName})
    const parts = asset.storageUrl.split("/");
    const fileName = parts[parts.length - 1];

    // Delete from MinIO
    try {
      await deleteAsset(asset.teamId, asset.id, fileName);
      console.log(`Deleted MinIO object: ${asset.storageUrl}`);
    } catch (error) {
      console.warn(`Failed to delete MinIO object ${asset.storageUrl}:`, error);
    }

    // Delete from database
    try {
      await prisma.auditLog.deleteMany({
        where: {
          targetType: "asset",
          targetId: asset.id,
        },
      });

      await prisma.asset.delete({
        where: { id: asset.id },
      });
      console.log(`Deleted asset record: ${asset.id}`);
    } catch (error) {
      console.warn(`Failed to delete asset record ${asset.id}:`, error);
    }
  }
});
