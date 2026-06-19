/**
 * 清理测试遗留的 MinIO 对象
 *
 * 使用方法：npx tsx scripts/cleanup-test-minio-objects.ts
 *
 * 警告：此脚本只清理测试文件名，不删除真实素材。
 * 清理范围限定在：
 * - voflow/{teamId}/assets/ 路径下
 * - 以下测试文件名：delete-test.jpg, test.jpg, test.mp3, test.mp4
 *
 * 注意：如果使用 --dry-run 参数，只会列出将要删除的对象，不会实际删除。
 */

import { getMinioClient, MINIO_BUCKET } from "@/lib/storage";

const DRY_RUN = process.argv.includes("--dry-run");

// 测试文件名模式
const TEST_FILE_NAMES = new Set([
  "delete-test.jpg",
  "test.jpg",
  "test.mp3",
  "test.mp4",
  "list-test.jpg",
  "filter-image.jpg",
  "filter-video.mp4",
  "license-test.jpg",
  "size-test.jpg",
  "access-url-test.jpg",
  "detail-test.jpg",
  "detail-size-test.jpg",
  "detail-access-test.jpg",
]);

/**
 * 检查对象路径是否为测试素材对象
 * 路径格式：voflow/{teamId}/assets/{assetId}/raw/{fileName}
 */
function isTestAssetObject(objectName: string): boolean {
  const parts = objectName.split("/");
  if (parts.length !== 6) {
    return false;
  }

  const [root, teamId, assetsSegment, assetId, rawSegment, fileName] = parts;

  return (
    root === "voflow" &&
    teamId.length > 0 &&
    assetsSegment === "assets" &&
    assetId.length > 0 &&
    rawSegment === "raw" &&
    TEST_FILE_NAMES.has(fileName)
  );
}

async function cleanupTestObjects() {
  const client = getMinioClient();

  console.log("Scanning MinIO bucket for test objects...");
  console.log(`Bucket: ${MINIO_BUCKET}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log("");

  const testObjects: string[] = [];
  let totalScanned = 0;

  try {
    // List all objects in voflow/*/assets/ paths
    const objects = await new Promise<any[]>((resolve, reject) => {
      const result: any[] = [];
      const stream = client.listObjectsV2(MINIO_BUCKET, "voflow/", true, "");

      stream.on("data", (obj) => {
        if (obj.name) {
          result.push(obj);
        }
      });

      stream.on("error", (err) => reject(err));
      stream.on("end", () => resolve(result));
    });

    totalScanned = objects.length;

    for (const obj of objects) {
      const objectName = obj.name;

      // Only clean up test assets under voflow/{teamId}/assets/{assetId}/raw/{fileName}
      if (!isTestAssetObject(objectName)) {
        continue;
      }

      testObjects.push(objectName);
    }

    console.log(`Total objects scanned: ${totalScanned}`);
    console.log(`Test objects found: ${testObjects.length}`);
    console.log("");

    if (testObjects.length === 0) {
      console.log("No test objects to clean up.");
      return;
    }

    console.log("Test objects to clean:");
    testObjects.forEach((obj) => console.log(`  - ${obj}`));
    console.log("");

    if (DRY_RUN) {
      console.log("Dry run mode: no objects will be deleted.");
      return;
    }

    // Delete test objects
    console.log("Deleting test objects...");
    for (const objectName of testObjects) {
      try {
        await client.removeObject(MINIO_BUCKET, objectName);
        console.log(`Deleted: ${objectName}`);
      } catch (error) {
        console.error(`Failed to delete ${objectName}:`, error);
      }
    }

    console.log("");
    console.log(`Cleanup complete. Deleted ${testObjects.length} test objects.`);
  } catch (error) {
    console.error("Error during cleanup:", error);
    process.exit(1);
  }
}

cleanupTestObjects().then(() => {
  console.log("\nDone.");
  process.exit(0);
}).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
