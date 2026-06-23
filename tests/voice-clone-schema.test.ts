import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";

async function getTableNames() {
  return prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('voice_samples', 'voice_consents', 'voice_clone_jobs', 'voices')
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

describe("Voice clone database schema", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates voice clone tables while reusing the existing voices table", async () => {
    await expect(getTableNames()).resolves.toEqual([
      { table_name: "voice_clone_jobs" },
      { table_name: "voice_consents" },
      { table_name: "voice_samples" },
      { table_name: "voices" },
    ]);

    await expect(getEnumValues("VoiceType")).resolves.toEqual(
      expect.arrayContaining([{ enumlabel: "cloned" }])
    );
  });

  it("creates voice sample, consent, and clone job columns", async () => {
    await expect(getColumns("voice_samples")).resolves.toEqual(
      expect.arrayContaining([
        { column_name: "id" },
        { column_name: "assetId" },
        { column_name: "teamId" },
        { column_name: "ownerId" },
        { column_name: "durationMs" },
        { column_name: "qualityReport" },
        { column_name: "createdAt" },
        { column_name: "updatedAt" },
      ])
    );

    await expect(getColumns("voice_consents")).resolves.toEqual(
      expect.arrayContaining([
        { column_name: "id" },
        { column_name: "voiceSampleId" },
        { column_name: "teamId" },
        { column_name: "userId" },
        { column_name: "consentText" },
        { column_name: "usageScope" },
        { column_name: "ipAddress" },
        { column_name: "device" },
        { column_name: "createdAt" },
      ])
    );

    await expect(getColumns("voice_clone_jobs")).resolves.toEqual(
      expect.arrayContaining([
        { column_name: "id" },
        { column_name: "workflowNodeId" },
        { column_name: "voiceSampleId" },
        { column_name: "provider" },
        { column_name: "status" },
        { column_name: "outputVoiceId" },
        { column_name: "errorJson" },
        { column_name: "createdAt" },
        { column_name: "updatedAt" },
      ])
    );
  });

  it("adds lookup indexes for team sample lists, consent lookup, and workflow job lookup", async () => {
    await expect(getIndexes("voice_samples")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexname: "voice_samples_teamId_createdAt_idx",
          indexdef: expect.stringContaining('"teamId"'),
        }),
        expect.objectContaining({
          indexname: "voice_samples_assetId_idx",
          indexdef: expect.stringContaining('"assetId"'),
        }),
      ])
    );

    await expect(getIndexes("voice_consents")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexname: "voice_consents_voiceSampleId_idx",
          indexdef: expect.stringContaining('"voiceSampleId"'),
        }),
        expect.objectContaining({
          indexname: "voice_consents_teamId_idx",
          indexdef: expect.stringContaining('"teamId"'),
        }),
      ])
    );

    await expect(getIndexes("voice_clone_jobs")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexname: "voice_clone_jobs_workflowNodeId_key",
          indexdef: expect.stringContaining('"workflowNodeId"'),
        }),
        expect.objectContaining({
          indexname: "voice_clone_jobs_voiceSampleId_idx",
          indexdef: expect.stringContaining('"voiceSampleId"'),
        }),
        expect.objectContaining({
          indexname: "voice_clone_jobs_outputVoiceId_idx",
          indexdef: expect.stringContaining('"outputVoiceId"'),
        }),
      ])
    );
  });
});
