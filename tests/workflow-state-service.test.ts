import { describe, expect, it } from "vitest";
import {
  WORKFLOW_NODE_STATUS,
  isWorkflowNodeStatusTransitionAllowed,
} from "@/lib/workflow/status";
import { WORKFLOW_ERROR_CODES } from "@/lib/workflow/errors";
import {
  transitionWorkflowNodeStatus,
  type WorkflowNodeStateRecord,
  type WorkflowNodeStateRepository,
} from "@/services/workflowStateService";

function createRepository(initialNode?: WorkflowNodeStateRecord) {
  let node = initialNode;
  const updates: Array<{
    nodeId: string;
    data: Parameters<WorkflowNodeStateRepository["updateNodeState"]>[1];
  }> = [];

  const repository: WorkflowNodeStateRepository = {
    findNodeById: async () => node ?? null,
    updateNodeState: async (nodeId, data) => {
      updates.push({ nodeId, data });
      node = {
        id: nodeId,
        status: data.status,
        requiresApproval: node?.requiresApproval ?? false,
      };
      return node;
    },
  };

  return { repository, updates };
}

describe("workflow node status state machine", () => {
  it("allows the Phase 5 happy-path transitions", () => {
    expect(
      isWorkflowNodeStatusTransitionAllowed({
        from: WORKFLOW_NODE_STATUS.PENDING,
        to: WORKFLOW_NODE_STATUS.QUEUED,
        requiresApproval: false,
      })
    ).toBe(true);
    expect(
      isWorkflowNodeStatusTransitionAllowed({
        from: WORKFLOW_NODE_STATUS.QUEUED,
        to: WORKFLOW_NODE_STATUS.RUNNING,
        requiresApproval: false,
      })
    ).toBe(true);
    expect(
      isWorkflowNodeStatusTransitionAllowed({
        from: WORKFLOW_NODE_STATUS.RUNNING,
        to: WORKFLOW_NODE_STATUS.SUCCEEDED,
        requiresApproval: true,
      })
    ).toBe(true);
    expect(
      isWorkflowNodeStatusTransitionAllowed({
        from: WORKFLOW_NODE_STATUS.SUCCEEDED,
        to: WORKFLOW_NODE_STATUS.WAITING_APPROVAL,
        requiresApproval: true,
      })
    ).toBe(true);
    expect(
      isWorkflowNodeStatusTransitionAllowed({
        from: WORKFLOW_NODE_STATUS.SUCCEEDED,
        to: WORKFLOW_NODE_STATUS.APPROVED,
        requiresApproval: false,
      })
    ).toBe(true);
  });

  it("allows retry, approval, and cancellation transitions from later phases", () => {
    expect(
      isWorkflowNodeStatusTransitionAllowed({
        from: WORKFLOW_NODE_STATUS.FAILED,
        to: WORKFLOW_NODE_STATUS.QUEUED,
        requiresApproval: false,
      })
    ).toBe(true);
    expect(
      isWorkflowNodeStatusTransitionAllowed({
        from: WORKFLOW_NODE_STATUS.WAITING_APPROVAL,
        to: WORKFLOW_NODE_STATUS.APPROVED,
        requiresApproval: true,
      })
    ).toBe(true);
    expect(
      isWorkflowNodeStatusTransitionAllowed({
        from: WORKFLOW_NODE_STATUS.RUNNING,
        to: WORKFLOW_NODE_STATUS.CANCELLED,
        requiresApproval: false,
      })
    ).toBe(true);
  });

  it("rejects invalid transitions and approval bypasses", () => {
    expect(
      isWorkflowNodeStatusTransitionAllowed({
        from: WORKFLOW_NODE_STATUS.PENDING,
        to: WORKFLOW_NODE_STATUS.RUNNING,
        requiresApproval: false,
      })
    ).toBe(false);
    expect(
      isWorkflowNodeStatusTransitionAllowed({
        from: WORKFLOW_NODE_STATUS.SUCCEEDED,
        to: WORKFLOW_NODE_STATUS.APPROVED,
        requiresApproval: true,
      })
    ).toBe(false);
    expect(
      isWorkflowNodeStatusTransitionAllowed({
        from: WORKFLOW_NODE_STATUS.APPROVED,
        to: WORKFLOW_NODE_STATUS.RUNNING,
        requiresApproval: false,
      })
    ).toBe(false);
  });
});

describe("transitionWorkflowNodeStatus", () => {
  it("updates a node when the transition is valid", async () => {
    const now = new Date("2026-06-19T12:00:00.000Z");
    const { repository, updates } = createRepository({
      id: "node-1",
      status: WORKFLOW_NODE_STATUS.QUEUED,
      requiresApproval: false,
    });

    const result = await transitionWorkflowNodeStatus(
      {
        nodeId: "node-1",
        toStatus: WORKFLOW_NODE_STATUS.RUNNING,
      },
      {
        repository,
        now: () => now,
      }
    );

    expect(result).toEqual({
      success: true,
      data: {
        id: "node-1",
        status: WORKFLOW_NODE_STATUS.RUNNING,
        requiresApproval: false,
      },
    });
    expect(updates).toEqual([
      {
        nodeId: "node-1",
        data: {
          status: WORKFLOW_NODE_STATUS.RUNNING,
          startedAt: now,
        },
      },
    ]);
  });

  it("sets finishedAt when a running node succeeds or fails", async () => {
    const now = new Date("2026-06-19T12:30:00.000Z");
    const { repository, updates } = createRepository({
      id: "node-1",
      status: WORKFLOW_NODE_STATUS.RUNNING,
      requiresApproval: false,
    });

    const result = await transitionWorkflowNodeStatus(
      {
        nodeId: "node-1",
        toStatus: WORKFLOW_NODE_STATUS.SUCCEEDED,
      },
      {
        repository,
        now: () => now,
      }
    );

    expect(result.success).toBe(true);
    expect(updates[0]).toEqual({
      nodeId: "node-1",
      data: {
        status: WORKFLOW_NODE_STATUS.SUCCEEDED,
        finishedAt: now,
      },
    });
  });

  it("returns an error and does not update when the transition is invalid", async () => {
    const { repository, updates } = createRepository({
      id: "node-1",
      status: WORKFLOW_NODE_STATUS.PENDING,
      requiresApproval: false,
    });

    const result = await transitionWorkflowNodeStatus(
      {
        nodeId: "node-1",
        toStatus: WORKFLOW_NODE_STATUS.RUNNING,
      },
      { repository }
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: WORKFLOW_ERROR_CODES.WORKFLOW_NODE_INVALID_TRANSITION,
        message: "节点状态流转非法",
      },
    });
    expect(updates).toEqual([]);
  });

  it("returns not found when the workflow node does not exist", async () => {
    const { repository, updates } = createRepository();

    const result = await transitionWorkflowNodeStatus(
      {
        nodeId: "missing-node",
        toStatus: WORKFLOW_NODE_STATUS.QUEUED,
      },
      { repository }
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: WORKFLOW_ERROR_CODES.WORKFLOW_NODE_NOT_FOUND,
        message: "工作流节点不存在",
      },
    });
    expect(updates).toEqual([]);
  });
});
