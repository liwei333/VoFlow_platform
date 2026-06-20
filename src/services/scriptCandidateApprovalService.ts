import type { ScriptCandidate } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serializeScript, type SerializedScript } from "@/lib/scripts/serializer";

export interface ApproveScriptCandidateInput {
  candidateId: string;
  jobId: string;
  teamId: string;
  confirmRisk?: boolean;
}

export interface SerializedScriptCandidate {
  id: string;
  scriptId: string;
  content: string;
  titleCandidates: unknown;
  riskReport: unknown;
  modelName: string | null;
  prompt: unknown;
  version: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApproveScriptCandidateOutput {
  candidate: SerializedScriptCandidate;
  script: SerializedScript;
}

export type ApproveScriptCandidateErrorCode =
  | "CANDIDATE_NOT_FOUND"
  | "VIDEO_JOB_NOT_FOUND"
  | "RISK_CONFIRMATION_REQUIRED";

export type ApproveScriptCandidateResult =
  | { success: true; data: ApproveScriptCandidateOutput }
  | { success: false; error: { code: ApproveScriptCandidateErrorCode } };

export async function approveScriptCandidate(
  input: ApproveScriptCandidateInput
): Promise<ApproveScriptCandidateResult> {
  const candidate = await prisma.scriptCandidate.findFirst({
    where: {
      id: input.candidateId,
      script: {
        project: {
          teamId: input.teamId,
        },
      },
    },
    include: {
      script: {
        select: {
          id: true,
          projectId: true,
        },
      },
    },
  });

  if (!candidate) {
    return { success: false, error: { code: "CANDIDATE_NOT_FOUND" } };
  }

  const job = await prisma.videoJob.findFirst({
    where: {
      id: input.jobId,
      teamId: input.teamId,
      projectId: candidate.script.projectId,
    },
    select: {
      id: true,
    },
  });

  if (!job) {
    return { success: false, error: { code: "VIDEO_JOB_NOT_FOUND" } };
  }

  if (candidateRequiresRiskConfirmation(candidate.riskReport) && input.confirmRisk !== true) {
    return { success: false, error: { code: "RISK_CONFIRMATION_REQUIRED" } };
  }

  const approved = await prisma.$transaction(async (tx) => {
    await tx.scriptCandidate.updateMany({
      where: {
        scriptId: candidate.scriptId,
        id: {
          not: candidate.id,
        },
      },
      data: {
        status: "rejected",
      },
    });

    const approvedCandidate = await tx.scriptCandidate.update({
      where: {
        id: candidate.id,
      },
      data: {
        status: "approved",
      },
    });

    const approvedScript = await tx.script.update({
      where: {
        id: candidate.scriptId,
      },
      data: {
        jobId: input.jobId,
        content: candidate.content,
        status: "approved",
      },
    });

    return {
      candidate: approvedCandidate,
      script: approvedScript,
    };
  });

  return {
    success: true,
    data: {
      candidate: serializeScriptCandidate(approved.candidate),
      script: serializeScript(approved.script),
    },
  };
}

function candidateRequiresRiskConfirmation(riskReport: unknown): boolean {
  return Boolean(
    riskReport &&
      typeof riskReport === "object" &&
      !Array.isArray(riskReport) &&
      "requiresApproval" in riskReport &&
      riskReport.requiresApproval === true
  );
}

function serializeScriptCandidate(candidate: ScriptCandidate): SerializedScriptCandidate {
  return {
    id: candidate.id,
    scriptId: candidate.scriptId,
    content: candidate.content,
    titleCandidates: candidate.titleCandidates,
    riskReport: candidate.riskReport,
    modelName: candidate.modelName,
    prompt: candidate.prompt,
    version: candidate.version,
    status: candidate.status,
    createdAt: candidate.createdAt.toISOString(),
    updatedAt: candidate.updatedAt.toISOString(),
  };
}
