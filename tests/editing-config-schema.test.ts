import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";

async function getTableNames() {
  return prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'editing_configs'
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

async function getCheckConstraints(tableName: string) {
  return prisma.$queryRaw<Array<{ conname: string; definition: string }>>`
    SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = ${tableName}
      AND c.contype = 'c'
    ORDER BY c.conname
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

describe("Editing config database schema", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates editing config table and pip position enum", async () => {
    await expect(getTableNames()).resolves.toEqual([
      { table_name: "editing_configs" },
    ]);

    await expect(getEnumValues("EditingPipPosition")).resolves.toEqual([
      { enumlabel: "top_left" },
      { enumlabel: "top_right" },
      { enumlabel: "bottom_left" },
      { enumlabel: "bottom_right" },
    ]);
  });

  it("adds editing columns for subtitle, pip, background, volumes, and preview artifact", async () => {
    await expect(getColumns("editing_configs")).resolves.toEqual(
      expect.arrayContaining([
        { column_name: "id" },
        { column_name: "jobId" },
        { column_name: "subtitleEnabled" },
        { column_name: "keywordHighlightEnabled" },
        { column_name: "bgmDuckingEnabled" },
        { column_name: "pipEnabled" },
        { column_name: "pipAssetId" },
        { column_name: "pipPosition" },
        { column_name: "pipSize" },
        { column_name: "backgroundAssetId" },
        { column_name: "voiceVolume" },
        { column_name: "bgmVolume" },
        { column_name: "transitionStrength" },
        { column_name: "configJson" },
        { column_name: "previewArtifactId" },
        { column_name: "createdAt" },
        { column_name: "updatedAt" },
      ])
    );
  });

  it("adds database constraints for pip size and volume ranges", async () => {
    await expect(getCheckConstraints("editing_configs")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conname: "editing_configs_pip_size_check",
          definition: expect.stringMatching(/pipSize.*>= 10.*pipSize.*<= 60/),
        }),
        expect.objectContaining({
          conname: "editing_configs_voice_volume_check",
          definition: expect.stringMatching(
            /voiceVolume.*>= 0.*voiceVolume.*<= 100/
          ),
        }),
        expect.objectContaining({
          conname: "editing_configs_bgm_volume_check",
          definition: expect.stringMatching(
            /bgmVolume.*>= 0.*bgmVolume.*<= 100/
          ),
        }),
      ])
    );
  });

  it("links editing config to its job, optional assets, and optional preview artifact", async () => {
    await expect(getForeignKeys("editing_configs")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          constraint_name: "editing_configs_jobId_fkey",
          column_name: "jobId",
          foreign_table_name: "video_jobs",
          foreign_column_name: "id",
        }),
        expect.objectContaining({
          constraint_name: "editing_configs_pipAssetId_fkey",
          column_name: "pipAssetId",
          foreign_table_name: "assets",
          foreign_column_name: "id",
        }),
        expect.objectContaining({
          constraint_name: "editing_configs_backgroundAssetId_fkey",
          column_name: "backgroundAssetId",
          foreign_table_name: "assets",
          foreign_column_name: "id",
        }),
        expect.objectContaining({
          constraint_name: "editing_configs_previewArtifactId_fkey",
          column_name: "previewArtifactId",
          foreign_table_name: "artifacts",
          foreign_column_name: "id",
        }),
      ])
    );
  });

  it("adds lookup indexes for job, assets, and preview artifact", async () => {
    await expect(getIndexes("editing_configs")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexname: "editing_configs_jobId_key",
          indexdef: expect.stringContaining('"jobId"'),
        }),
        expect.objectContaining({
          indexname: "editing_configs_pipAssetId_idx",
          indexdef: expect.stringContaining('"pipAssetId"'),
        }),
        expect.objectContaining({
          indexname: "editing_configs_backgroundAssetId_idx",
          indexdef: expect.stringContaining('"backgroundAssetId"'),
        }),
        expect.objectContaining({
          indexname: "editing_configs_previewArtifactId_idx",
          indexdef: expect.stringContaining('"previewArtifactId"'),
        }),
      ])
    );
  });
});
