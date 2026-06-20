import { Prisma } from "@prisma/client";
import { buildScriptRiskReport, type ScriptRiskReport } from "@/lib/scripts/riskChecker";
import { WORKFLOW_NODE_STATUS } from "@/lib/workflow/status";
import { prisma } from "@/lib/db";

export interface RunScriptRiskCheckInput {
  scriptId: string;
  content: string;
  nodeId?: string;
}

export interface RunScriptRiskCheckResult {
  report: ScriptRiskReport;
  candidateId: string;
}

export async function runScriptRiskCheck(input: RunScriptRiskCheckInput): Promise<RunScriptRiskCheckResult> {
  const report = buildScriptRiskReport(input.content);

  const result = await prisma.$transaction(async (tx) => {
    const existingVersion = await tx.scriptCandidate.aggregate({
      where: { scriptId: input.scriptId },
      _max: {
        version: true,
      },
    });
    const version = (existingVersion._max.version ?? 0) + 1;

    const candidate = await tx.scriptCandidate.create({
      data: {
        scriptId: input.scriptId,
        content: input.content,
        riskReport: toPrismaJson(report),
        version,
        status: "draft",
      },
      select: {
        id: true,
      },
    });

    if (input.nodeId) {
      await tx.workflowNode.update({
        where: { id: input.nodeId },
        data: report.requiresApproval
          ? {
              status: WORKFLOW_NODE_STATUS.WAITING_APPROVAL,
              requiresApproval: true,
              output: toPrismaJson({ riskReport: report, candidateId: candidate.id }),
            }
          : {
              output: toPrismaJson({ riskReport: report, candidateId: candidate.id }),
            },
      });
    }

    return candidate;
  });

  return {
    report,
    candidateId: result.id,
  };
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}
