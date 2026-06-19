import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { MemoryWorkflowQueue, type WorkflowQueue } from "@/lib/queue/adapter";
import { createVideoJob } from "@/services/videoJobService";
import { WORKFLOW_ERROR_CODES } from "@/lib/workflow/errors";
import { DEFAULT_WORKFLOW_TEMPLATE, WORKFLOW_NODE_DEFINITIONS } from "@/lib/workflow/constants";

describe("createVideoJob", () => {
  let testUser: { id: string };
  let testTeam: { id: string };
  let testProject: { id: string };
  let otherTeam: { id: string };
  let otherProject: { id: string };
  let archivedProject: { id: string };
  let testQueue: MemoryWorkflowQueue;
  let createdUserIds: string[];
  let createdTeamIds: string[];
  let createdProjectIds: string[];
  let createdJobIds: string[];

  beforeEach(async () => {
    testQueue = new MemoryWorkflowQueue();
    createdUserIds = [];
    createdTeamIds = [];
    createdProjectIds = [];
    createdJobIds = [];

    // Generate unique email to avoid conflicts
    const uniqueEmail = `test_${Date.now()}@example.com`;

    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: uniqueEmail,
        passwordHash: "hashed_password",
        name: "Test User",
      },
    });
    createdUserIds.push(testUser.id);

    // Create test team
    testTeam = await prisma.team.create({
      data: {
        name: "Test Team",
        ownerId: testUser.id,
      },
    });
    createdTeamIds.push(testTeam.id);

    // Add user as team member
    await prisma.teamMember.create({
      data: {
        teamId: testTeam.id,
        userId: testUser.id,
        role: "member",
      },
    });

    // Create test project
    testProject = await prisma.project.create({
      data: {
        teamId: testTeam.id,
        ownerId: testUser.id,
        name: "Test Project",
        targetPlatform: "douyin",
        aspectRatio: "ratio_16_9",
      },
    });
    createdProjectIds.push(testProject.id);

    // Create another team for permission tests
    otherTeam = await prisma.team.create({
      data: {
        name: "Other Team",
        ownerId: testUser.id,
      },
    });
    createdTeamIds.push(otherTeam.id);

    // Create project in other team
    otherProject = await prisma.project.create({
      data: {
        teamId: otherTeam.id,
        ownerId: testUser.id,
        name: "Other Project",
        targetPlatform: "douyin",
        aspectRatio: "ratio_16_9",
      },
    });
    createdProjectIds.push(otherProject.id);

    // Create archived project
    archivedProject = await prisma.project.create({
      data: {
        teamId: testTeam.id,
        ownerId: testUser.id,
        name: "Archived Project",
        targetPlatform: "douyin",
        aspectRatio: "ratio_16_9",
        status: "archived",
      },
    });
    createdProjectIds.push(archivedProject.id);
  });

  afterEach(async () => {
    await prisma.artifact.deleteMany({
      where: { jobId: { in: createdJobIds } },
    });
    await prisma.workflowNode.deleteMany({
      where: { jobId: { in: createdJobIds } },
    });
    await prisma.videoJob.deleteMany({
      where: { id: { in: createdJobIds } },
    });
    await prisma.project.deleteMany({
      where: { id: { in: createdProjectIds } },
    });
    await prisma.teamMember.deleteMany({
      where: {
        OR: [
          { teamId: { in: createdTeamIds } },
          { userId: { in: createdUserIds } },
        ],
      },
    });
    await prisma.team.deleteMany({
      where: { id: { in: createdTeamIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
  });

  async function createJobForTest(
    input = {
      projectId: testProject.id,
      ownerId: testUser.id,
      teamId: testTeam.id,
    },
    queue: WorkflowQueue = testQueue
  ) {
    const result = await createVideoJob(input, {
      queue,
      createTraceId: () => "trace-test-1",
    });

    if (result.success) {
      createdJobIds.push(result.data.jobId);
    }

    return result;
  }

  it("should reject when project does not exist", async () => {
    const result = await createVideoJob({
      projectId: "non-existent-project-id",
      ownerId: testUser.id,
      teamId: testTeam.id,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(WORKFLOW_ERROR_CODES.PROJECT_NOT_FOUND);
    }
  });

  it("should reject when project belongs to another team", async () => {
    const result = await createVideoJob({
      projectId: otherProject.id,
      ownerId: testUser.id,
      teamId: testTeam.id,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(WORKFLOW_ERROR_CODES.PROJECT_ACCESS_DENIED);
    }
  });

  it("should reject when user is not a team member", async () => {
    const newUser = await prisma.user.create({
      data: {
        email: `newuser_${Date.now()}@example.com`,
        passwordHash: "hashed_password",
        name: "New User",
      },
    });
    createdUserIds.push(newUser.id);

    const result = await createJobForTest({
      projectId: testProject.id,
      ownerId: newUser.id,
      teamId: testTeam.id,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(WORKFLOW_ERROR_CODES.TEAM_ACCESS_DENIED);
    }
  });

  it("should reject when project is archived", async () => {
    const result = await createVideoJob({
      projectId: archivedProject.id,
      ownerId: testUser.id,
      teamId: testTeam.id,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(WORKFLOW_ERROR_CODES.PROJECT_ARCHIVED);
    }
  });

  it("should create video job with workflow nodes", async () => {
    const result = await createJobForTest();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.jobId).toBeDefined();
      expect(result.data.nodeIds).toHaveLength(DEFAULT_WORKFLOW_TEMPLATE.length);
    }
  });

  it("should create workflow nodes with correct requiresApproval values", async () => {
    const result = await createJobForTest();

    expect(result.success).toBe(true);
    if (result.success) {
      // Verify each node has correct requiresApproval value
      const nodes = await prisma.workflowNode.findMany({
        where: { jobId: result.data.jobId },
        orderBy: { createdAt: "asc" },
      });

      expect(nodes).toHaveLength(DEFAULT_WORKFLOW_TEMPLATE.length);

      nodes.forEach((node, index) => {
        const expectedType = DEFAULT_WORKFLOW_TEMPLATE[index];
        const expectedDefinition = WORKFLOW_NODE_DEFINITIONS[expectedType];

        expect(node.nodeType).toBe(expectedType);
        expect(node.requiresApproval).toBe(expectedDefinition.requiresApproval);
        expect(node.version).toBe(1);
        expect(node.status).toBe("pending");
      });
    }
  });

  it("should enqueue the first node", async () => {
    const result = await createJobForTest();

    expect(result.success).toBe(true);
    if (result.success) {
      // Check queue contains the first node
      const queuedJobs = testQueue.getQueue();
      expect(queuedJobs).toHaveLength(1);
      expect(queuedJobs[0].jobId).toBe(result.data.jobId);
      expect(queuedJobs[0].nodeId).toBe(result.data.nodeIds[0]);
      expect(queuedJobs[0].nodeType).toBe(DEFAULT_WORKFLOW_TEMPLATE[0]);
      expect(queuedJobs[0].version).toBe(1);
      expect(queuedJobs[0].traceId).toBe("trace-test-1");
    }
  });

  it("should only enqueue the first node, not all nodes", async () => {
    const result = await createJobForTest();

    expect(result.success).toBe(true);

    // Should only have one job in queue (first node only)
    const queuedJobs = testQueue.getQueue();
    expect(queuedJobs).toHaveLength(1);
  });

  it("should set currentNode to the first node type", async () => {
    const result = await createJobForTest();

    expect(result.success).toBe(true);
    if (result.success) {
      const job = await prisma.videoJob.findUnique({
        where: { id: result.data.jobId },
      });

      expect(job?.currentNode).toBe(DEFAULT_WORKFLOW_TEMPLATE[0]);
      expect(job?.status).toBe("pending");
      expect(job?.progress).toBe(0);
    }
  });

  it("should not leave video job or nodes when enqueue fails", async () => {
    const failingQueue: WorkflowQueue = {
      enqueue: async () => {
        throw new Error("queue unavailable");
      },
    };

    const result = await createJobForTest(undefined, failingQueue);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(WORKFLOW_ERROR_CODES.ENQUEUE_FAILED);
    }

    await expect(
      prisma.videoJob.count({ where: { projectId: testProject.id } })
    ).resolves.toBe(0);
    await expect(
      prisma.workflowNode.count({
        where: { job: { projectId: testProject.id } },
      })
    ).resolves.toBe(0);
  });
});
