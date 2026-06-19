import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type AuditLogContext = {
  teamId: string;
  userId: string;
};

type AuditLogClient = Prisma.TransactionClient | typeof prisma;

export type AuditLogMetadata = Prisma.InputJsonValue | null | undefined;

export async function writeAuditLog(
  action: AuditAction,
  targetType: string,
  targetId: string,
  metadata: AuditLogMetadata,
  context: AuditLogContext,
  client: AuditLogClient = prisma
) {
  return client.auditLog.create({
    data: {
      teamId: context.teamId,
      userId: context.userId,
      action,
      targetType,
      targetId,
      metadata: metadata === null ? Prisma.JsonNull : metadata,
    },
  });
}
