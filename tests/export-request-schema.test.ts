import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";

async function getTableNames() {
  return prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'export_requests'
    ORDER BY table_name
  `;
}

async function getColumns(tableName: string) {
  return prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
    ORDER BY ordinal_position
  `;
}

async function getEnumValues(enumName: string) {
  return prisma.$queryRaw<Array<{ enumlabel: string }>>`
    SELECT e.enumlabel
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = ${enumName}
    ORDER BY e.enumsortorder
  `;
}

async function getIndexes(tableName: string) {
  return prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = ${tableName}
    ORDER BY indexname
  `;
}

async function getForeignKeys(tableName: string) {
  return prisma.$queryRaw<
    Array<{
      constraint_name: string;
      column_name: string;
      foreign_table_name: string;
      foreign_column_name: string;
    }>
  >`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = ${tableName}
    ORDER BY tc.constraint_name
  `;
}

describe("Export request database schema", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates export request table with output profile and status enums", async () => {
    await expect(getTableNames()).resolves.toEqual([
      { table_name: "export_requests" },
    ]);

    await expect(getEnumValues("ExportOutputProfile")).resolves.toEqual([
      { enumlabel: "mp4_720p" },
      { enumlabel: "mp4_1080p" },
    ]);

    await expect(getEnumValues("ExportRequestStatus")).resolves.toEqual([
      { enumlabel: "queued" },
      { enumlabel: "running" },
      { enumlabel: "succeeded" },
      { enumlabel: "failed" },
    ]);
  });

  it("adds export request columns for upstream artifacts, editing config, cover, and status", async () => {
    await expect(getColumns("export_requests")).resolves.toEqual(
      expect.arrayContaining([
        { column_name: "id" },
        { column_name: "jobId" },
        { column_name: "nodeId" },
        { column_name: "avatarVideoArtifactId" },
        { column_name: "audioArtifactId" },
        { column_name: "editingConfigId" },
        { column_name: "subtitleArtifactId" },
        { column_name: "bgmAssetId" },
        { column_name: "coverArtifactId" },
        { column_name: "outputProfile" },
        { column_name: "status" },
        { column_name: "errorJson" },
        { column_name: "createdAt" },
        { column_name: "updatedAt" },
      ])
    );
  });

  it("links export requests to job, node, media artifacts, editing config, and optional BGM asset", async () => {
    await expect(getForeignKeys("export_requests")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          constraint_name: "export_requests_jobId_fkey",
          column_name: "jobId",
          foreign_table_name: "video_jobs",
          foreign_column_name: "id",
        }),
        expect.objectContaining({
          constraint_name: "export_requests_nodeId_fkey",
          column_name: "nodeId",
          foreign_table_name: "workflow_nodes",
          foreign_column_name: "id",
        }),
        expect.objectContaining({
          constraint_name: "export_requests_avatarVideoArtifactId_fkey",
          column_name: "avatarVideoArtifactId",
          foreign_table_name: "artifacts",
          foreign_column_name: "id",
        }),
        expect.objectContaining({
          constraint_name: "export_requests_audioArtifactId_fkey",
          column_name: "audioArtifactId",
          foreign_table_name: "artifacts",
          foreign_column_name: "id",
        }),
        expect.objectContaining({
          constraint_name: "export_requests_editingConfigId_fkey",
          column_name: "editingConfigId",
          foreign_table_name: "editing_configs",
          foreign_column_name: "id",
        }),
        expect.objectContaining({
          constraint_name: "export_requests_subtitleArtifactId_fkey",
          column_name: "subtitleArtifactId",
          foreign_table_name: "artifacts",
          foreign_column_name: "id",
        }),
        expect.objectContaining({
          constraint_name: "export_requests_bgmAssetId_fkey",
          column_name: "bgmAssetId",
          foreign_table_name: "assets",
          foreign_column_name: "id",
        }),
        expect.objectContaining({
          constraint_name: "export_requests_coverArtifactId_fkey",
          column_name: "coverArtifactId",
          foreign_table_name: "artifacts",
          foreign_column_name: "id",
        }),
      ])
    );
  });

  it("adds lookup indexes for job, node, export status, profile, and optional media", async () => {
    await expect(getIndexes("export_requests")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexname: "export_requests_jobId_createdAt_idx",
          indexdef: expect.stringContaining('"jobId"'),
        }),
        expect.objectContaining({
          indexname: "export_requests_nodeId_idx",
          indexdef: expect.stringContaining('"nodeId"'),
        }),
        expect.objectContaining({
          indexname: "export_requests_status_idx",
          indexdef: expect.stringContaining("status"),
        }),
        expect.objectContaining({
          indexname: "export_requests_outputProfile_idx",
          indexdef: expect.stringContaining('"outputProfile"'),
        }),
        expect.objectContaining({
          indexname: "export_requests_bgmAssetId_idx",
          indexdef: expect.stringContaining('"bgmAssetId"'),
        }),
        expect.objectContaining({
          indexname: "export_requests_coverArtifactId_idx",
          indexdef: expect.stringContaining('"coverArtifactId"'),
        }),
      ])
    );
  });
});
