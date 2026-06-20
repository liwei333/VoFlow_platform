import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";

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

describe("Local model monitor database schema", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates local_model_services with service status fields", async () => {
    await expect(getColumns("local_model_services")).resolves.toEqual(
      expect.arrayContaining([
        { column_name: "id" },
        { column_name: "serviceType" },
        { column_name: "name" },
        { column_name: "baseUrl" },
        { column_name: "modelName" },
        { column_name: "status" },
        { column_name: "latencyMs" },
        { column_name: "resource" },
        { column_name: "lastError" },
        { column_name: "checkedAt" },
        { column_name: "createdAt" },
        { column_name: "updatedAt" },
      ])
    );
  });

  it("adds local model service type and status enums", async () => {
    await expect(getEnumValues("LocalModelServiceType")).resolves.toEqual([
      { enumlabel: "llm" },
      { enumlabel: "asr" },
      { enumlabel: "tts" },
      { enumlabel: "avatar" },
      { enumlabel: "ffmpeg" },
    ]);

    await expect(getEnumValues("LocalModelServiceStatus")).resolves.toEqual([
      { enumlabel: "online" },
      { enumlabel: "offline" },
      { enumlabel: "busy" },
      { enumlabel: "misconfigured" },
    ]);
  });

  it("adds lookup indexes for service type and status", async () => {
    await expect(getIndexes("local_model_services")).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexname: "local_model_services_serviceType_key",
          indexdef: expect.stringContaining('"serviceType"'),
        }),
        expect.objectContaining({
          indexname: "local_model_services_status_idx",
          indexdef: expect.stringContaining("status"),
        }),
      ])
    );
  });
});
