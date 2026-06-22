import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";

async function getTableNames() {
  return prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('avatars', 'avatar_consents')
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

describe("Avatar database schema", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates avatar asset tables with ownership, source asset, license, and quality fields", async () => {
    await expect(getTableNames()).resolves.toEqual([
      { table_name: "avatar_consents" },
      { table_name: "avatars" },
    ]);

    await expect(getColumns("avatars")).resolves.toEqual(
      expect.arrayContaining([
        { column_name: "id" },
        { column_name: "teamId" },
        { column_name: "ownerId" },
        { column_name: "name" },
        { column_name: "sourceAssetId" },
        { column_name: "provider" },
        { column_name: "status" },
        { column_name: "licenseStatus" },
        { column_name: "qualityReport" },
        { column_name: "previewUrl" },
        { column_name: "metadata" },
        { column_name: "createdAt" },
        { column_name: "updatedAt" },
        { column_name: "deletedAt" },
      ])
    );

    await expect(getColumns("avatar_consents")).resolves.toEqual(
      expect.arrayContaining([
        { column_name: "id" },
        { column_name: "avatarId" },
        { column_name: "teamId" },
        { column_name: "userId" },
        { column_name: "consentType" },
        { column_name: "consentText" },
        { column_name: "usageScope" },
        { column_name: "ipAddress" },
        { column_name: "device" },
        { column_name: "createdAt" },
      ])
    );
  });

  it("adds avatar status enum values and reuses license status enum values", async () => {
    await expect(getEnumValues("AvatarStatus")).resolves.toEqual([
      { enumlabel: "draft" },
      { enumlabel: "ready" },
      { enumlabel: "disabled" },
      { enumlabel: "deleted" },
    ]);

    await expect(getEnumValues("LicenseStatus")).resolves.toEqual(
      expect.arrayContaining([
        { enumlabel: "pending" },
        { enumlabel: "approved" },
        { enumlabel: "rejected" },
      ])
    );
  });

  it("adds lookup indexes for team lists, source asset lookup, and consent lookup", async () => {
    await expect(getIndexes("avatars")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexname: "avatars_teamId_createdAt_idx",
          indexdef: expect.stringContaining('"teamId"'),
        }),
        expect.objectContaining({
          indexname: "avatars_teamId_status_idx",
          indexdef: expect.stringContaining("status"),
        }),
        expect.objectContaining({
          indexname: "avatars_sourceAssetId_idx",
          indexdef: expect.stringContaining('"sourceAssetId"'),
        }),
      ])
    );

    await expect(getIndexes("avatar_consents")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexname: "avatar_consents_avatarId_idx",
          indexdef: expect.stringContaining('"avatarId"'),
        }),
        expect.objectContaining({
          indexname: "avatar_consents_teamId_idx",
          indexdef: expect.stringContaining('"teamId"'),
        }),
      ])
    );
  });
});
