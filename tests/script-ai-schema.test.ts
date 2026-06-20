import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";

async function getTableNames() {
  return prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('scripts', 'script_candidates', 'asr_segments')
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

describe("Script AI database schema", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates scripts, script_candidates, and asr_segments tables", async () => {
    await expect(getTableNames()).resolves.toEqual([
      { table_name: "asr_segments" },
      { table_name: "script_candidates" },
      { table_name: "scripts" },
    ]);

    await expect(getColumns("scripts")).resolves.toEqual(
      expect.arrayContaining([
        { column_name: "id" },
        { column_name: "projectId" },
        { column_name: "jobId" },
        { column_name: "sourceType" },
        { column_name: "content" },
        { column_name: "metadata" },
        { column_name: "version" },
        { column_name: "status" },
        { column_name: "createdAt" },
        { column_name: "updatedAt" },
      ])
    );

    await expect(getColumns("script_candidates")).resolves.toEqual(
      expect.arrayContaining([
        { column_name: "id" },
        { column_name: "scriptId" },
        { column_name: "content" },
        { column_name: "titleCandidates" },
        { column_name: "riskReport" },
        { column_name: "modelName" },
        { column_name: "prompt" },
        { column_name: "version" },
        { column_name: "status" },
        { column_name: "createdAt" },
        { column_name: "updatedAt" },
      ])
    );

    await expect(getColumns("asr_segments")).resolves.toEqual(
      expect.arrayContaining([
        { column_name: "id" },
        { column_name: "scriptId" },
        { column_name: "startMs" },
        { column_name: "endMs" },
        { column_name: "text" },
        { column_name: "createdAt" },
      ])
    );
  });

  it("adds source and status enums for script records", async () => {
    await expect(getEnumValues("ScriptSourceType")).resolves.toEqual([
      { enumlabel: "pasted" },
      { enumlabel: "asr" },
      { enumlabel: "generated" },
    ]);

    await expect(getEnumValues("ScriptStatus")).resolves.toEqual([
      { enumlabel: "draft" },
      { enumlabel: "ready" },
      { enumlabel: "approved" },
      { enumlabel: "archived" },
    ]);

    await expect(getEnumValues("ScriptCandidateStatus")).resolves.toEqual([
      { enumlabel: "draft" },
      { enumlabel: "approved" },
      { enumlabel: "rejected" },
    ]);
  });

  it("adds lookup indexes for project, job, and script relationships", async () => {
    await expect(getIndexes("scripts")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexname: "scripts_projectId_idx",
          indexdef: expect.stringContaining('"projectId"'),
        }),
        expect.objectContaining({
          indexname: "scripts_jobId_idx",
          indexdef: expect.stringContaining('"jobId"'),
        }),
      ])
    );

    await expect(getIndexes("script_candidates")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexname: "script_candidates_scriptId_idx",
          indexdef: expect.stringContaining('"scriptId"'),
        }),
      ])
    );

    await expect(getIndexes("asr_segments")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexname: "asr_segments_scriptId_idx",
          indexdef: expect.stringContaining('"scriptId"'),
        }),
      ])
    );
  });

  it("adds numeric validation constraints for script and segment versions", async () => {
    await expect(getCheckConstraints("scripts")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conname: "scripts_version_check",
          definition: expect.stringMatching(/version >= 1/),
        }),
      ])
    );

    await expect(getCheckConstraints("script_candidates")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conname: "script_candidates_version_check",
          definition: expect.stringMatching(/version >= 1/),
        }),
      ])
    );

    await expect(getCheckConstraints("asr_segments")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conname: "asr_segments_time_range_check",
          definition: expect.stringMatching(/"startMs" >= 0.*"endMs" >= "startMs"/),
        }),
      ])
    );
  });
});
