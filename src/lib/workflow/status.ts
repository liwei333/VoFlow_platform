export const WORKFLOW_NODE_STATUS = {
  PENDING: "pending",
  QUEUED: "queued",
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  WAITING_APPROVAL: "waiting_approval",
  APPROVED: "approved",
  CANCELLED: "cancelled",
} as const;

export type WorkflowNodeStatus =
  (typeof WORKFLOW_NODE_STATUS)[keyof typeof WORKFLOW_NODE_STATUS];

export const WORKFLOW_NODE_STATUS_TRANSITIONS: Record<
  WorkflowNodeStatus,
  readonly WorkflowNodeStatus[]
> = {
  [WORKFLOW_NODE_STATUS.PENDING]: [WORKFLOW_NODE_STATUS.QUEUED],
  [WORKFLOW_NODE_STATUS.QUEUED]: [WORKFLOW_NODE_STATUS.RUNNING],
  [WORKFLOW_NODE_STATUS.RUNNING]: [
    WORKFLOW_NODE_STATUS.SUCCEEDED,
    WORKFLOW_NODE_STATUS.FAILED,
    WORKFLOW_NODE_STATUS.CANCELLED,
  ],
  [WORKFLOW_NODE_STATUS.SUCCEEDED]: [
    WORKFLOW_NODE_STATUS.WAITING_APPROVAL,
    WORKFLOW_NODE_STATUS.APPROVED,
  ],
  [WORKFLOW_NODE_STATUS.FAILED]: [
    WORKFLOW_NODE_STATUS.QUEUED,
    WORKFLOW_NODE_STATUS.CANCELLED,
  ],
  [WORKFLOW_NODE_STATUS.WAITING_APPROVAL]: [
    WORKFLOW_NODE_STATUS.APPROVED,
    WORKFLOW_NODE_STATUS.CANCELLED,
  ],
  [WORKFLOW_NODE_STATUS.APPROVED]: [],
  [WORKFLOW_NODE_STATUS.CANCELLED]: [],
} as const;

export interface WorkflowNodeStatusTransitionInput {
  from: WorkflowNodeStatus;
  to: WorkflowNodeStatus;
  requiresApproval: boolean;
}

export function isWorkflowNodeStatusTransitionAllowed({
  from,
  to,
  requiresApproval,
}: WorkflowNodeStatusTransitionInput): boolean {
  if (!WORKFLOW_NODE_STATUS_TRANSITIONS[from].includes(to)) {
    return false;
  }

  if (from !== WORKFLOW_NODE_STATUS.SUCCEEDED) {
    return true;
  }

  if (requiresApproval) {
    return to === WORKFLOW_NODE_STATUS.WAITING_APPROVAL;
  }

  return to === WORKFLOW_NODE_STATUS.APPROVED;
}
