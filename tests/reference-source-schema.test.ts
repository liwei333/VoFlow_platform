import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";

async function getTableNames() {
  return prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('reference_sources')
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

describe("Reference source database schema", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates reference_sources with source, result, and error fields", async () => {
    await expect(getTableNames()).resolves.toEqual([{ table_name: "reference_sources" }]);

    await expect(getColumns("reference_sources")).resolves.toEqual(
      expect.arrayContaining([
        { column_name: "id" },
        { column_name: "projectId" },
        { column_name: "teamId" },
        { column_name: "sourceType" },
        { column_name: "platform" },
        { column_name: "sourceUrl" },
        { column_name: "assetId" },
        { column_name: "status" },
        { column_name: "durationMs" },
        { column_name: "transcriptScriptId" },
        { column_name: "title" },
        { column_name: "thumbnailUrl" },
        { column_name: "metadataJson" },
        { column_name: "subtitleJson" },
        { column_name: "importMode" },
        { column_name: "consentStatus" },
        { column_name: "consentConfirmedAt" },
        { column_name: "consentConfirmedBy" },
        { column_name: "structureJson" },
        { column_name: "errorJson" },
        { column_name: "createdAt" },
        { column_name: "updatedAt" },
      ])
    );
  });

  it("adds source type and status enums for reference records", async () => {
    await expect(getEnumValues("ReferenceSourceType")).resolves.toEqual([
      { enumlabel: "url" },
      { enumlabel: "asset" },
      { enumlabel: "pasted_text" },
    ]);

    await expect(getEnumValues("ReferenceSourceStatus")).resolves.toEqual(
      expect.arrayContaining([
        { enumlabel: "pending" },
        { enumlabel: "parsing" },
        { enumlabel: "metadata_ready" },
        { enumlabel: "transcribing" },
        { enumlabel: "analyzing" },
        { enumlabel: "succeeded" },
        { enumlabel: "failed" },
      ])
    );
  });

  it("adds import mode and consent status enums for public URL import", async () => {
    await expect(getEnumValues("ReferenceImportMode")).resolves.toEqual([
      { enumlabel: "metadata_only" },
      { enumlabel: "subtitle_only" },
      { enumlabel: "audio_extract" },
      { enumlabel: "uploaded_asset" },
    ]);

    await expect(getEnumValues("ReferenceConsentStatus")).resolves.toEqual([
      { enumlabel: "pending" },
      { enumlabel: "confirmed" },
      { enumlabel: "rejected" },
    ]);
  });

  it("adds lookup indexes for project and team scoped reference lists", async () => {
    await expect(getIndexes("reference_sources")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexname: "reference_sources_projectId_createdAt_idx",
          indexdef: expect.stringContaining('"projectId"'),
        }),
        expect.objectContaining({
          indexname: "reference_sources_teamId_createdAt_idx",
          indexdef: expect.stringContaining('"teamId"'),
        }),
        expect.objectContaining({
          indexname: "reference_sources_assetId_idx",
          indexdef: expect.stringContaining('"assetId"'),
        }),
      ])
    );
  });
});
