import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GET } from "@/app/api/video-jobs/[jobId]/publish-drafts/route";
import { PUT } from "@/app/api/publish-drafts/[draftId]/route";

describe("Publish draft query and edit APIs", () => {
  let userId: string;
  let teamId: string;
  let otherTeamId: string;
  let projectId: string;
  let otherProjectId: string;
  let jobId: string;
  let otherJobId: string;
  let nodeId: string;
  let draftId: string;
  let coverArtifactId: string;
  let otherCoverArtifactId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `publish_drafts_api_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Publish Drafts API User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Publish Drafts API Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const otherTeam = await prisma.team.create({
      data: {
        name: "Other Publish Drafts API Team",
        ownerId: userId,
      },
    });
    otherTeamId = otherTeam.id;

    await prisma.teamMember.createMany({
      data: [
        { teamId, userId, role: "member" },
        { teamId: otherTeamId, userId, role: "member" },
      ],
    });

    const project = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "Publish Drafts API Project",
        targetPlatform: "douyin",
        aspectRatio: "ratio_9_16",
      },
    });
    projectId = project.id;

    const otherProject = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "Other Publish Drafts API Project",
        targetPlatform: "douyin",
        aspectRatio: "ratio_9_16",
      },
    });
    otherProjectId = otherProject.id;

    const job = await prisma.videoJob.create({
      data: {
        projectId,
        teamId,
        ownerId: userId,
        status: "running",
      },
    });
    jobId = job.id;

    const otherJob = await prisma.videoJob.create({
      data: {
        projectId: otherProjectId,
        teamId,
        ownerId: userId,
        status: "running",
      },
    });
    otherJobId = otherJob.id;

    const node = await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: "cover",
        status: "succeeded",
        version: 1,
      },
    });
    nodeId = node.id;

    const coverArtifact = await prisma.artifact.create({
      data: {
        jobId,
        nodeId,
        type: "cover",
        storageUrl: "voflow/team/jobs/job-1/cover/cover.jpg",
        metadata: {
          aspectRatio: "9:16",
        },
      },
    });
    coverArtifactId = coverArtifact.id;

    const otherNode = await prisma.workflowNode.create({
      data: {
        jobId: otherJobId,
        nodeType: "cover",
        status: "succeeded",
        version: 1,
      },
    });
    const otherCoverArtifact = await prisma.artifact.create({
      data: {
        jobId: otherJobId,
        nodeId: otherNode.id,
        type: "cover",
        storageUrl: "voflow/team/jobs/job-2/cover/cover.jpg",
      },
    });
    otherCoverArtifactId = otherCoverArtifact.id;

    const draft = await prisma.publishDraft.create({
      data: {
        jobId,
        platform: "douyin",
        title: "原始标题",
        description: "原始描述",
        tagsJson: ["原标签"],
        topicsJson: ["原话题"],
        validationJson: {
          stale: true,
        },
      },
    });
    draftId = draft.id;

    await prisma.publishDraft.create({
      data: {
        jobId,
        platform: "xiaohongshu",
        title: "小红书标题",
        description: "小红书描述",
        tagsJson: ["生活"],
        topicsJson: [],
      },
    });
  });

  afterEach(async () => {
    await prisma.publish.deleteMany({ where: { jobId: { in: [jobId, otherJobId] } } });
    await prisma.publishDraft.deleteMany({ where: { jobId: { in: [jobId, otherJobId] } } });
    await prisma.artifact.deleteMany({ where: { jobId: { in: [jobId, otherJobId] } } });
    await prisma.workflowNode.deleteMany({ where: { jobId: { in: [jobId, otherJobId] } } });
    await prisma.videoJob.deleteMany({ where: { id: { in: [jobId, otherJobId] } } });
    await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
    await prisma.teamMember.deleteMany({
      where: {
        OR: [{ teamId }, { teamId: otherTeamId }, { userId }],
      },
    });
    await prisma.team.deleteMany({ where: { id: { in: [teamId, otherTeamId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("requires authentication when querying drafts", async () => {
    const response = await GET(createRequest(), {
      params: Promise.resolve({ jobId }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "UNAUTHORIZED",
      message: "未登录",
    });
  });

  it("returns drafts for a job in the current team", async () => {
    const response = await GET(await createAuthenticatedRequest(teamId), {
      params: Promise.resolve({ jobId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      data: {
        drafts: [
          {
            id: draftId,
            jobId,
            platform: "douyin",
            title: "原始标题",
            description: "原始描述",
            tags: ["原标签"],
            topics: ["原话题"],
            coverArtifactId: null,
            validationJson: {
              stale: true,
            },
            rule: {
              label: "抖音",
              title: {
                maxChars: 55,
              },
              tags: {
                maxCount: 5,
              },
            },
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          },
          {
            platform: "xiaohongshu",
            title: "小红书标题",
          },
        ],
      },
    });
  });

  it("returns 404 when querying drafts across teams", async () => {
    const response = await GET(await createAuthenticatedRequest(otherTeamId), {
      params: Promise.resolve({ jobId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "视频任务不存在",
    });
  });

  it("updates title, description, tags, topics, and cover artifact", async () => {
    const response = await PUT(
      await createAuthenticatedRequest(teamId, {
        title: "更新后的标题",
        description: "更新后的描述",
        tags: ["新品", "新品", "爆款"],
        topics: ["618", "618", "口播"],
        coverArtifactId,
      }),
      {
        params: Promise.resolve({ draftId }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      message: "发布草稿已保存",
      data: {
        draft: {
          id: draftId,
          title: "更新后的标题",
          description: "更新后的描述",
          tags: ["新品", "爆款"],
          topics: ["618", "口播"],
          coverArtifactId,
          validationJson: null,
        },
      },
    });

    const saved = await prisma.publishDraft.findUniqueOrThrow({ where: { id: draftId } });
    expect(saved.title).toBe("更新后的标题");
    expect(saved.tagsJson).toEqual(["新品", "爆款"]);
    expect(saved.topicsJson).toEqual(["618", "口播"]);
    expect(saved.coverArtifactId).toBe(coverArtifactId);
    expect(saved.validationJson).toBeNull();
  });

  it("rejects edits outside platform title and tag limits", async () => {
    const titleResponse = await PUT(
      await createAuthenticatedRequest(teamId, {
        title: "这是一条明确超过小红书二十字限制的发布标题内容",
      }),
      {
        params: Promise.resolve({ draftId: await getXiaohongshuDraftId() }),
      }
    );

    expect(titleResponse.status).toBe(400);
    await expect(titleResponse.json()).resolves.toEqual({
      code: "PUBLISH_DRAFT_TITLE_TOO_LONG",
      message: "标题超过平台限制",
    });

    const tagsResponse = await PUT(
      await createAuthenticatedRequest(teamId, {
        tags: ["1", "2", "3", "4", "5", "6"],
      }),
      {
        params: Promise.resolve({ draftId }),
      }
    );

    expect(tagsResponse.status).toBe(400);
    await expect(tagsResponse.json()).resolves.toEqual({
      code: "PUBLISH_DRAFT_TAGS_TOO_MANY",
      message: "标签数量超过平台限制",
    });
  });

  it("returns 404 for cross-team drafts and foreign cover artifacts", async () => {
    const crossTeamResponse = await PUT(
      await createAuthenticatedRequest(otherTeamId, {
        title: "不应保存",
      }),
      {
        params: Promise.resolve({ draftId }),
      }
    );

    expect(crossTeamResponse.status).toBe(404);
    await expect(crossTeamResponse.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "发布草稿不存在",
    });

    const coverResponse = await PUT(
      await createAuthenticatedRequest(teamId, {
        coverArtifactId: otherCoverArtifactId,
      }),
      {
        params: Promise.resolve({ draftId }),
      }
    );

    expect(coverResponse.status).toBe(404);
    await expect(coverResponse.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "封面素材不存在",
    });
  });

  async function getXiaohongshuDraftId(): Promise<string> {
    const draft = await prisma.publishDraft.findFirstOrThrow({
      where: {
        jobId,
        platform: "xiaohongshu",
      },
      select: {
        id: true,
      },
    });
    return draft.id;
  }

  async function createAuthenticatedRequest(team: string, body?: unknown): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      email: "publish-drafts-api@example.com",
      name: "Publish Drafts API User",
      teamId: team,
    });
    const request = createRequest(body);
    request.cookies.set("session", token);

    return request;
  }
});

function createRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/video-jobs/job-1/publish-drafts", {
    method: body === undefined ? "GET" : "PUT",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers:
      body === undefined
        ? undefined
        : {
            "Content-Type": "application/json",
          },
  });
}
