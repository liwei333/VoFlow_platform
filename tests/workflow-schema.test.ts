import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";

async function getTableNames() {
  return prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('video_jobs', 'workflow_nodes', 'artifacts')
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

describe("Workflow database schema", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates the workflow tables with the Phase 1 columns", async () => {
    await expect(getTableNames()).resolves.toEqual([
      { table_name: "artifacts" },
      { table_name: "video_jobs" },
      { table_name: "workflow_nodes" },
    ]);

    await expect(getColumns("video_jobs")).resolves.toEqual(
      expect.arrayContaining([
        { column_name: "id" },
        { column_name: "projectId" },
        { column_name: "teamId" },
        { column_name: "ownerId" },
        { column_name: "status" },
        { column_name: "currentNode" },
        { column_name: "progress" },
        { column_name: "errorCode" },
        { column_name: "errorMessage" },
        { column_name: "createdAt" },
        { column_name: "updatedAt" },
      ])
    );

    await expect(getColumns("workflow_nodes")).resolves.toEqual(
      expect.arrayContaining([
        { column_name: "id" },
        { column_name: "jobId" },
        { column_name: "nodeType" },
        { column_name: "status" },
        { column_name: "version" },
        { column_name: "input" },
        { column_name: "output" },
        { column_name: "error" },
        { column_name: "retryCount" },
        { column_name: "requiresApproval" },
        { column_name: "startedAt" },
        { column_name: "finishedAt" },
        { column_name: "createdAt" },
        { column_name: "updatedAt" },
      ])
    );

    await expect(getColumns("artifacts")).resolves.toEqual(
      expect.arrayContaining([
        { column_name: "id" },
        { column_name: "jobId" },
        { column_name: "nodeId" },
        { column_name: "type" },
        { column_name: "storageUrl" },
        { column_name: "metadata" },
        { column_name: "createdAt" },
      ])
    );
  });

  it("adds status enums and numeric validation constraints", async () => {
    await expect(getEnumValues("VideoJobStatus")).resolves.toEqual([
      { enumlabel: "pending" },
      { enumlabel: "queued" },
      { enumlabel: "running" },
      { enumlabel: "succeeded" },
      { enumlabel: "failed" },
      { enumlabel: "cancelled" },
    ]);

    await expect(getEnumValues("WorkflowNodeStatus")).resolves.toEqual([
      { enumlabel: "pending" },
      { enumlabel: "queued" },
      { enumlabel: "running" },
      { enumlabel: "succeeded" },
      { enumlabel: "failed" },
      { enumlabel: "waiting_approval" },
      { enumlabel: "approved" },
      { enumlabel: "cancelled" },
    ]);

    await expect(getCheckConstraints("video_jobs")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conname: "video_jobs_progress_check",
          definition: expect.stringMatching(/progress >= 0/),
        }),
      ])
    );

    await expect(getCheckConstraints("workflow_nodes")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conname: "workflow_nodes_version_check",
          definition: expect.stringMatching(/version >= 1/),
        }),
      ])
    );
  });

  it("adds project, team, and job lookup indexes", async () => {
    await expect(getIndexes("video_jobs")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexname: "video_jobs_projectId_idx",
          indexdef: expect.stringContaining('"projectId"'),
        }),
        expect.objectContaining({
          indexname: "video_jobs_teamId_createdAt_idx",
          indexdef: expect.stringContaining('"teamId"'),
        }),
      ])
    );

    await expect(getIndexes("workflow_nodes")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexname: "workflow_nodes_jobId_idx",
          indexdef: expect.stringContaining('"jobId"'),
        }),
      ])
    );

    await expect(getIndexes("artifacts")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexname: "artifacts_jobId_idx",
          indexdef: expect.stringContaining('"jobId"'),
        }),
      ])
    );
  });
});
