import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";

describe("Audit log service", () => {
  let teamId: string;
  let userId: string;
  const createdAuditLogIds: string[] = [];

  beforeAll(async () => {
    const user = await prisma.user.findUnique({
      where: { email: "dev@voflow.local" },
      include: { teamMemberships: true },
    });

    if (!user?.teamMemberships[0]?.teamId) {
      throw new Error("dev user seed data is required for audit log tests");
    }

    userId = user.id;
    teamId = user.teamMemberships[0].teamId;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: {
        id: { in: createdAuditLogIds },
      },
    });
  });

  it("writes an audit log with actor, target, and metadata", async () => {
    const targetId = `test-audit-${crypto.randomUUID()}`;

    const auditLog = await writeAuditLog(
      "asset_upload",
      "asset",
      targetId,
      {
        name: "Audit Test Asset",
        type: "image",
      },
      {
        teamId,
        userId,
      }
    );
    createdAuditLogIds.push(auditLog.id);

    const persisted = await prisma.auditLog.findUnique({
      where: { id: auditLog.id },
    });

    expect(persisted).toMatchObject({
      id: auditLog.id,
      teamId,
      userId,
      action: "asset_upload",
      targetType: "asset",
      targetId,
      metadata: {
        name: "Audit Test Asset",
        type: "image",
      },
    });
  });
});
