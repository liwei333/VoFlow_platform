import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";

async function getTableNames() {
  return prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('channel_accounts', 'publish_drafts', 'publishes')
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

describe("Publish assistant database schema", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates publish tables and platform/status enums", async () => {
    await expect(getTableNames()).resolves.toEqual([
      { table_name: "channel_accounts" },
      { table_name: "publish_drafts" },
      { table_name: "publishes" },
    ]);

    await expect(getEnumValues("PublishPlatform")).resolves.toEqual([
      { enumlabel: "douyin" },
      { enumlabel: "kuaishou" },
      { enumlabel: "xiaohongshu" },
      { enumlabel: "wechat_channels" },
      { enumlabel: "bilibili" },
      { enumlabel: "youtube_shorts" },
      { enumlabel: "tiktok" },
    ]);

    await expect(getEnumValues("ChannelAccountStatus")).resolves.toEqual([
      { enumlabel: "connected" },
      { enumlabel: "expired" },
      { enumlabel: "revoked" },
      { enumlabel: "not_connected" },
    ]);

    await expect(getEnumValues("PublishStatus")).resolves.toEqual([
      { enumlabel: "pending" },
      { enumlabel: "uploading" },
      { enumlabel: "published" },
      { enumlabel: "failed" },
      { enumlabel: "skipped" },
    ]);
  });

  it("adds channel account columns for team, user, platform, encrypted token, and status", async () => {
    await expect(getColumns("channel_accounts")).resolves.toEqual(
      expect.arrayContaining([
        { column_name: "id" },
        { column_name: "teamId" },
        { column_name: "userId" },
        { column_name: "platform" },
        { column_name: "accountName" },
        { column_name: "encryptedToken" },
        { column_name: "status" },
        { column_name: "expiresAt" },
        { column_name: "createdAt" },
        { column_name: "updatedAt" },
      ])
    );
  });

  it("adds publish draft columns for per-platform metadata and validation result", async () => {
    await expect(getColumns("publish_drafts")).resolves.toEqual(
      expect.arrayContaining([
        { column_name: "id" },
        { column_name: "jobId" },
        { column_name: "platform" },
        { column_name: "title" },
        { column_name: "description" },
        { column_name: "tagsJson" },
        { column_name: "topicsJson" },
        { column_name: "coverArtifactId" },
        { column_name: "validationJson" },
        { column_name: "createdAt" },
        { column_name: "updatedAt" },
      ])
    );
  });

  it("adds publish columns for platform status, remote request ids, and error history", async () => {
    await expect(getColumns("publishes")).resolves.toEqual(
      expect.arrayContaining([
        { column_name: "id" },
        { column_name: "jobId" },
        { column_name: "publishDraftId" },
        { column_name: "channelAccountId" },
        { column_name: "platform" },
        { column_name: "status" },
        { column_name: "requestId" },
        { column_name: "remoteId" },
        { column_name: "errorJson" },
        { column_name: "createdAt" },
        { column_name: "updatedAt" },
      ])
    );
  });

  it("links publish tables to teams, users, jobs, artifacts, drafts, and channel accounts", async () => {
    await expect(getForeignKeys("channel_accounts")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          constraint_name: "channel_accounts_teamId_fkey",
          column_name: "teamId",
          foreign_table_name: "teams",
          foreign_column_name: "id",
        }),
        expect.objectContaining({
          constraint_name: "channel_accounts_userId_fkey",
          column_name: "userId",
          foreign_table_name: "users",
          foreign_column_name: "id",
        }),
      ])
    );

    await expect(getForeignKeys("publish_drafts")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          constraint_name: "publish_drafts_jobId_fkey",
          column_name: "jobId",
          foreign_table_name: "video_jobs",
          foreign_column_name: "id",
        }),
        expect.objectContaining({
          constraint_name: "publish_drafts_coverArtifactId_fkey",
          column_name: "coverArtifactId",
          foreign_table_name: "artifacts",
          foreign_column_name: "id",
        }),
      ])
    );

    await expect(getForeignKeys("publishes")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          constraint_name: "publishes_jobId_fkey",
          column_name: "jobId",
          foreign_table_name: "video_jobs",
          foreign_column_name: "id",
        }),
        expect.objectContaining({
          constraint_name: "publishes_publishDraftId_fkey",
          column_name: "publishDraftId",
          foreign_table_name: "publish_drafts",
          foreign_column_name: "id",
        }),
        expect.objectContaining({
          constraint_name: "publishes_channelAccountId_fkey",
          column_name: "channelAccountId",
          foreign_table_name: "channel_accounts",
          foreign_column_name: "id",
        }),
      ])
    );
  });

  it("adds lookup indexes and one draft per job platform", async () => {
    await expect(getIndexes("channel_accounts")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexname: "channel_accounts_teamId_platform_idx",
          indexdef: expect.stringContaining('"teamId"'),
        }),
        expect.objectContaining({
          indexname: "channel_accounts_userId_idx",
          indexdef: expect.stringContaining('"userId"'),
        }),
        expect.objectContaining({
          indexname: "channel_accounts_status_idx",
          indexdef: expect.stringContaining("status"),
        }),
      ])
    );

    await expect(getIndexes("publish_drafts")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexname: "publish_drafts_jobId_platform_key",
          indexdef: expect.stringContaining('"jobId"'),
        }),
        expect.objectContaining({
          indexname: "publish_drafts_platform_idx",
          indexdef: expect.stringContaining("platform"),
        }),
        expect.objectContaining({
          indexname: "publish_drafts_coverArtifactId_idx",
          indexdef: expect.stringContaining('"coverArtifactId"'),
        }),
      ])
    );

    await expect(getIndexes("publishes")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexname: "publishes_jobId_platform_idx",
          indexdef: expect.stringContaining('"jobId"'),
        }),
        expect.objectContaining({
          indexname: "publishes_publishDraftId_idx",
          indexdef: expect.stringContaining('"publishDraftId"'),
        }),
        expect.objectContaining({
          indexname: "publishes_channelAccountId_idx",
          indexdef: expect.stringContaining('"channelAccountId"'),
        }),
        expect.objectContaining({
          indexname: "publishes_status_idx",
          indexdef: expect.stringContaining("status"),
        }),
      ])
    );
  });
});
