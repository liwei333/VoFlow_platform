import { WORKFLOW_NODE_STATUS } from "@/lib/workflow/status";
import { runScriptRiskCheck } from "@/services/scriptRiskService";
import type { WorkflowNodeHandler } from "@/services/workflowWorkerService";

export const SCRIPT_RISK_INVALID_NODE_INPUT = "SCRIPT_RISK_INVALID_NODE_INPUT";

interface RiskWorkflowNodeInput {
  sourceType: "risk_check";
  scriptId: string;
  content: string;
}

export function createRiskWorkflowNodeHandler(): WorkflowNodeHandler {
  return async ({ payload, input }) => {
    const parsedInput = parseRiskWorkflowNodeInput(input);
    const result = await runScriptRiskCheck({
      scriptId: parsedInput.scriptId,
      content: parsedInput.content,
      nodeId: payload.nodeId,
    });

    return {
      status: result.report.requiresApproval ? WORKFLOW_NODE_STATUS.WAITING_APPROVAL : undefined,
      requiresApproval: result.report.requiresApproval,
      output: {
        sourceType: parsedInput.sourceType,
        scriptId: parsedInput.scriptId,
        candidateId: result.candidateId,
        riskReport: result.report,
      },
    };
  };
}

function parseRiskWorkflowNodeInput(input: unknown): RiskWorkflowNodeInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new RiskWorkerError(SCRIPT_RISK_INVALID_NODE_INPUT, "风险检查节点输入无效");
  }

  const value = input as Partial<RiskWorkflowNodeInput>;
  if (
    value.sourceType !== "risk_check" ||
    typeof value.scriptId !== "string" ||
    typeof value.content !== "string"
  ) {
    throw new RiskWorkerError(SCRIPT_RISK_INVALID_NODE_INPUT, "风险检查节点输入无效");
  }

  return {
    sourceType: value.sourceType,
    scriptId: value.scriptId,
    content: value.content,
  };
}

class RiskWorkerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "RiskWorkerError";
    this.code = code;
  }
}
