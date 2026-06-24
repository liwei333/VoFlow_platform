import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";

async function getTableNames() {
  return prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'avatar_render_requests'
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

describe("Avatar render request database schema", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates avatar render request table and enum constraints", async () => {
    await expect(getTableNames()).resolves.toEqual([
      { table_name: "avatar_render_requests" },
    ]);

    await expect(getEnumValues("AvatarRenderMode")).resolves.toEqual([
      { enumlabel: "preview" },
      { enumlabel: "hd" },
    ]);

    await expect(getEnumValues("AvatarRenderCrop")).resolves.toEqual([
      { enumlabel: "head" },
      { enumlabel: "half_body" },
    ]);

    await expect(getEnumValues("AspectRatio")).resolves.toEqual(
      expect.arrayContaining([
        { enumlabel: "ratio_9_16" },
        { enumlabel: "ratio_16_9" },
        { enumlabel: "ratio_1_1" },
      ])
    );
  });

  it("adds request columns for mode, crop, aspect ratio, and linked artifacts", async () => {
    await expect(getColumns("avatar_render_requests")).resolves.toEqual(
      expect.arrayContaining([
        { column_name: "id" },
        { column_name: "jobId" },
        { column_name: "nodeId" },
        { column_name: "avatarId" },
        { column_name: "audioArtifactId" },
        { column_name: "mode" },
        { column_name: "aspectRatio" },
        { column_name: "crop" },
        { column_name: "provider" },
        { column_name: "providerRequestId" },
        { column_name: "createdAt" },
        { column_name: "updatedAt" },
      ])
    );
  });

  it("adds lookup indexes for workflow execution and artifact joins", async () => {
    await expect(getIndexes("avatar_render_requests")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexname: "avatar_render_requests_jobId_createdAt_idx",
          indexdef: expect.stringContaining('"jobId"'),
        }),
        expect.objectContaining({
          indexname: "avatar_render_requests_nodeId_idx",
          indexdef: expect.stringContaining('"nodeId"'),
        }),
        expect.objectContaining({
          indexname: "avatar_render_requests_avatarId_idx",
          indexdef: expect.stringContaining('"avatarId"'),
        }),
        expect.objectContaining({
          indexname: "avatar_render_requests_audioArtifactId_idx",
          indexdef: expect.stringContaining('"audioArtifactId"'),
        }),
      ])
    );
  });

  it("links each render request to job, node, avatar, and audio artifact", async () => {
    await expect(getForeignKeys("avatar_render_requests")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          constraint_name: "avatar_render_requests_jobId_fkey",
          column_name: "jobId",
          foreign_table_name: "video_jobs",
          foreign_column_name: "id",
        }),
        expect.objectContaining({
          constraint_name: "avatar_render_requests_nodeId_fkey",
          column_name: "nodeId",
          foreign_table_name: "workflow_nodes",
          foreign_column_name: "id",
        }),
        expect.objectContaining({
          constraint_name: "avatar_render_requests_avatarId_fkey",
          column_name: "avatarId",
          foreign_table_name: "avatars",
          foreign_column_name: "id",
        }),
        expect.objectContaining({
          constraint_name: "avatar_render_requests_audioArtifactId_fkey",
          column_name: "audioArtifactId",
          foreign_table_name: "artifacts",
          foreign_column_name: "id",
        }),
      ])
    );
  });
});
