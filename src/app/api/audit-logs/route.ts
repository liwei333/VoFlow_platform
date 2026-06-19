import { NextRequest } from "next/server";
import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { internalError, success, validationError } from "@/lib/api-response";

import { z } from "zod";

const dateTimeQueryParam = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid datetime",
  })
  .transform((value) => new Date(value));

const listAuditLogsQuerySchema = z
  .object({
    page: z.string().transform(Number).pipe(z.number().int().min(1)).optional().default("1"),
    pageSize: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default("20"),
    action: z.nativeEnum(AuditAction).optional(),
    targetType: z.string().trim().min(1).max(64).optional(),
    createdAtFrom: dateTimeQueryParam.optional(),
    createdAtTo: dateTimeQueryParam.optional(),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  })
  .superRefine((query, context) => {
    if (query.createdAtFrom && query.createdAtTo && query.createdAtFrom > query.createdAtTo) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["created_at_to"],
        message: "created_at_to must be greater than or equal to created_at_from",
      });
    }
  });

function normalizeAuditLogQueryParams(searchParams: URLSearchParams) {
  const queryParams = Object.fromEntries(searchParams.entries());

  return {
    ...queryParams,
    targetType: queryParams.targetType ?? queryParams.target_type,
    createdAtFrom: queryParams.createdAtFrom ?? queryParams.created_at_from,
    createdAtTo: queryParams.createdAtTo ?? queryParams.created_at_to,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;

  try {
    const { searchParams } = new URL(request.url);
    const parsed = listAuditLogsQuerySchema.safeParse(
      normalizeAuditLogQueryParams(searchParams)
    );

    if (!parsed.success) {
      return validationError(parsed.error.errors);
    }

    const {
      page,
      pageSize,
      action,
      targetType,
      createdAtFrom,
      createdAtTo,
      sortOrder,
    } = parsed.data;

    const where: Prisma.AuditLogWhereInput = {
      teamId: session.teamId,
    };

    if (action) {
      where.action = action;
    }

    if (targetType) {
      where.targetType = targetType;
    }

    if (createdAtFrom || createdAtTo) {
      where.createdAt = {
        ...(createdAtFrom ? { gte: createdAtFrom } : {}),
        ...(createdAtTo ? { lte: createdAtTo } : {}),
      };
    }

    const skip = (page - 1) * pageSize;

    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: {
          createdAt: sortOrder,
        },
        skip,
        take: pageSize,
        select: {
          id: true,
          teamId: true,
          userId: true,
          action: true,
          targetType: true,
          targetId: true,
          metadata: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return success({
      auditLogs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("List audit logs error:", error);
    return internalError();
  }
}
