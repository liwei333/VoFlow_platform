import { describe, expect, it } from "vitest";
import { DEFAULT_WORKFLOW_TEMPLATE } from "@/lib/workflow/constants";
import { WORKFLOW_ERROR_CODES } from "@/lib/workflow/errors";
import { WORKFLOW_NODE_STATUS, type WorkflowNodeStatus } from "@/lib/workflow/status";
import {
  calculateWorkflowProgress,
  syncWorkflowJobProgress,
  type WorkflowProgressNode,
  type WorkflowProgressRepository,
} from "@/services/workflowProgressService";

function createWorkflowNodes(
  statusByIndex: Partial<Record<number, WorkflowNodeStatus>>,
  errorByIndex: Partial<Record<number, WorkflowProgressNode["error"]>> = {}
): WorkflowProgressNode[] {
  return DEFAULT_WORKFLOW_TEMPLATE.map((nodeType, index) => ({
    id: `node-${index + 1}`,
    nodeType,
    status: statusByIndex[index] ?? WORKFLOW_NODE_STATUS.PENDING,
    error: errorByIndex[index] ?? null,
  }));
}

function createRepository(
  nodes: WorkflowProgressNode[] | null,
  jobId = "job-1"
) {
  const updates: Array<{
    jobId: string;
    data: Parameters<WorkflowProgressRepository["updateJobProgress"]>[1];
  }> = [];

  const repository: WorkflowProgressRepository = {
    findJobProgressSnapshot: async (requestedJobId) => {
      if (!nodes || requestedJobId !== jobId) {
        return null;
      }

      return { id: jobId, nodes };
    },
    updateJobProgress: async (requestedJobId, data) => {
      updates.push({ jobId: requestedJobId, data });
      return {
        id: requestedJobId,
        ...data,
      };
    },
  };

  return { repository, updates };
}

describe("calculateWorkflowProgress", () => {
  it("calculates weighted progress and selects the first active node", () => {
    const nodes = createWorkflowNodes({
      0: WORKFLOW_NODE_STATUS.APPROVED,
      1: WORKFLOW_NODE_STATUS.SUCCEEDED,
      2: WORKFLOW_NODE_STATUS.RUNNING,
    });

    expect(calculateWorkflowProgress(nodes)).toEqual({
      progress: 15,
      currentNode: "script_rewrite",
      errorCode: null,
      errorMessage: null,
    });
  });

  it("keeps a waiting approval node as the current node without counting it complete", () => {
    const nodes = createWorkflowNodes({
      0: WORKFLOW_NODE_STATUS.APPROVED,
      1: WORKFLOW_NODE_STATUS.WAITING_APPROVAL,
      2: WORKFLOW_NODE_STATUS.PENDING,
    });

    expect(calculateWorkflowProgress(nodes)).toEqual({
      progress: 7,
      currentNode: "script_prepare",
      errorCode: null,
      errorMessage: null,
    });
  });

  it("syncs the first failed node error into the job progress snapshot", () => {
    const nodes = createWorkflowNodes(
      {
        0: WORKFLOW_NODE_STATUS.APPROVED,
        1: WORKFLOW_NODE_STATUS.FAILED,
        2: WORKFLOW_NODE_STATUS.PENDING,
      },
      {
        1: {
          code: "WORKFLOW_NODE_TIMEOUT",
          message: "节点执行超时",
        },
      }
    );

    expect(calculateWorkflowProgress(nodes)).toEqual({
      progress: 7,
      currentNode: "script_prepare",
      errorCode: "WORKFLOW_NODE_TIMEOUT",
      errorMessage: "节点执行超时",
    });
  });

  it("returns 100 progress and clears currentNode when all nodes are complete", () => {
    const nodes = createWorkflowNodes(
      Object.fromEntries(
        DEFAULT_WORKFLOW_TEMPLATE.map((_, index) => [
          index,
          WORKFLOW_NODE_STATUS.APPROVED,
        ])
      )
    );

    expect(calculateWorkflowProgress(nodes)).toEqual({
      progress: 100,
      currentNode: null,
      errorCode: null,
      errorMessage: null,
    });
  });
});

describe("syncWorkflowJobProgress", () => {
  it("updates the video job progress fields from workflow nodes", async () => {
    const nodes = createWorkflowNodes({
      0: WORKFLOW_NODE_STATUS.APPROVED,
      1: WORKFLOW_NODE_STATUS.SUCCEEDED,
      2: WORKFLOW_NODE_STATUS.RUNNING,
    });
    const { repository, updates } = createRepository(nodes);

    const result = await syncWorkflowJobProgress(
      { jobId: "job-1" },
      { repository }
    );

    expect(result).toEqual({
      success: true,
      data: {
        id: "job-1",
        progress: 15,
        currentNode: "script_rewrite",
        errorCode: null,
        errorMessage: null,
      },
    });
    expect(updates).toEqual([
      {
        jobId: "job-1",
        data: {
          progress: 15,
          currentNode: "script_rewrite",
          errorCode: null,
          errorMessage: null,
        },
      },
    ]);
  });

  it("returns not found and does not update when the video job is missing", async () => {
    const { repository, updates } = createRepository(null);

    const result = await syncWorkflowJobProgress(
      { jobId: "missing-job" },
      { repository }
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: WORKFLOW_ERROR_CODES.WORKFLOW_JOB_NOT_FOUND,
        message: "工作流任务不存在",
      },
    });
    expect(updates).toEqual([]);
  });
});
