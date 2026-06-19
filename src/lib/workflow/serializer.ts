import {
  WORKFLOW_NODE_DEFINITIONS,
  isWorkflowNodeType,
  type WorkflowNodeType,
} from "@/lib/workflow/constants";

export interface WorkflowJobDetailRecord {
  id: string;
  projectId: string;
  teamId: string;
  ownerId: string;
  status: string;
  currentNode: string | null;
  progress: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  nodes: WorkflowNodeDetailRecord[];
  artifacts: WorkflowArtifactSummaryRecord[];
}

export interface WorkflowNodeDetailRecord {
  id: string;
  jobId: string;
  nodeType: string;
  status: string;
  version: number;
  input: unknown;
  output: unknown;
  error: unknown;
  retryCount: number;
  requiresApproval: boolean;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowArtifactSummaryRecord {
  id: string;
  jobId: string;
  nodeId: string;
  type: string;
  storageUrl: string;
  metadata: unknown;
  createdAt: Date;
}

export interface SerializedWorkflowJobDetail {
  id: string;
  projectId: string;
  teamId: string;
  ownerId: string;
  status: string;
  currentNode: string | null;
  progress: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  nodes: SerializedWorkflowNodeDetail[];
  artifacts: SerializedWorkflowArtifactSummary[];
}

export interface SerializedWorkflowNodeDetail {
  id: string;
  jobId: string;
  nodeType: string;
  status: string;
  version: number;
  input: unknown;
  output: unknown;
  error: unknown;
  retryCount: number;
  requiresApproval: boolean;
  retryable: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedWorkflowArtifactSummary {
  id: string;
  jobId: string;
  nodeId: string;
  type: string;
  storageUrl: string;
  metadata: unknown;
  createdAt: string;
}

export function serializeWorkflowJobDetail(
  job: WorkflowJobDetailRecord
): SerializedWorkflowJobDetail {
  const latestNodes = selectLatestWorkflowNodes(job.nodes);

  return {
    id: job.id,
    projectId: job.projectId,
    teamId: job.teamId,
    ownerId: job.ownerId,
    status: job.status,
    currentNode: job.currentNode,
    progress: job.progress,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    nodes: latestNodes.map(serializeWorkflowNodeDetail),
    artifacts: job.artifacts.map(serializeWorkflowArtifactSummary),
  };
}

export function selectLatestWorkflowNodes(
  nodes: WorkflowNodeDetailRecord[]
): WorkflowNodeDetailRecord[] {
  const latestByType = new Map<string, WorkflowNodeDetailRecord>();

  for (const node of nodes) {
    const current = latestByType.get(node.nodeType);
    if (!current || isNewerWorkflowNodeVersion(node, current)) {
      latestByType.set(node.nodeType, node);
    }
  }

  return [...latestByType.values()].sort(compareWorkflowNodeOrder);
}

function serializeWorkflowNodeDetail(
  node: WorkflowNodeDetailRecord
): SerializedWorkflowNodeDetail {
  const retryable = isWorkflowNodeType(node.nodeType)
    ? WORKFLOW_NODE_DEFINITIONS[node.nodeType].retryable
    : false;

  return {
    id: node.id,
    jobId: node.jobId,
    nodeType: node.nodeType,
    status: node.status,
    version: node.version,
    input: node.input,
    output: node.output,
    error: node.error,
    retryCount: node.retryCount,
    requiresApproval: node.requiresApproval,
    retryable,
    startedAt: node.startedAt?.toISOString() ?? null,
    finishedAt: node.finishedAt?.toISOString() ?? null,
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
  };
}

function serializeWorkflowArtifactSummary(
  artifact: WorkflowArtifactSummaryRecord
): SerializedWorkflowArtifactSummary {
  return {
    id: artifact.id,
    jobId: artifact.jobId,
    nodeId: artifact.nodeId,
    type: artifact.type,
    storageUrl: artifact.storageUrl,
    metadata: artifact.metadata,
    createdAt: artifact.createdAt.toISOString(),
  };
}

function isNewerWorkflowNodeVersion(
  candidate: WorkflowNodeDetailRecord,
  current: WorkflowNodeDetailRecord
): boolean {
  if (candidate.version !== current.version) {
    return candidate.version > current.version;
  }

  return candidate.createdAt.getTime() > current.createdAt.getTime();
}

function compareWorkflowNodeOrder(
  left: WorkflowNodeDetailRecord,
  right: WorkflowNodeDetailRecord
): number {
  return getWorkflowNodeOrder(left.nodeType) - getWorkflowNodeOrder(right.nodeType);
}

function getWorkflowNodeOrder(nodeType: string): number {
  if (!isWorkflowNodeType(nodeType)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return WORKFLOW_NODE_DEFINITIONS[nodeType as WorkflowNodeType].order;
}
