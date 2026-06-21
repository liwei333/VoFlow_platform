import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { POST as createFromAsset } from "@/app/api/projects/[projectId]/references/from-asset/route";
import { POST as createFromUrl } from "@/app/api/projects/[projectId]/references/from-url/route";
import { GET as listReferences } from "@/app/api/projects/[projectId]/references/route";
import { GET as getReference } from "@/app/api/references/[referenceSourceId]/route";
import { POST as retryReference } from "@/app/api/references/[referenceSourceId]/retry/route";
import {
  DEFAULT_REFERENCE_LINK_PARSERS,
  type ReferenceLinkParser,
} from "@/lib/references/parser";

describe("Reference source API", () => {
  let userId: string;
  let teamId: string;
  let otherTeamId: string;
  let projectId: string;
  let otherProjectId: string;
  let audioAssetId: string;
  let imageAssetId: string;
  let referenceSourceIds: string[] = [];
  let jobIds: string[] = [];

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `reference_api_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Reference API User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Reference API Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const otherTeam = await prisma.team.create({
      data: {
        name: "Other Reference API Team",
        ownerId: userId,
      },
    });
    otherTeamId = otherTeam.id;

    await prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role: "member",
      },
    });

    projectId = (
      await prisma.project.create({
        data: {
          teamId,
          ownerId: userId,
          name: "Reference API Project",
          targetPlatform: "douyin",
          aspectRatio: "ratio_9_16",
        },
      })
    ).id;

    otherProjectId = (
      await prisma.project.create({
        data: {
          teamId: otherTeamId,
          ownerId: userId,
          name: "Other Reference API Project",
          targetPlatform: "douyin",
          aspectRatio: "ratio_9_16",
        },
      })
    ).id;

    audioAssetId = (
      await prisma.asset.create({
        data: {
          teamId,
          ownerId: userId,
          type: "audio",
          name: "reference-api.wav",
          storageUrl: "voflow/reference-api/reference-api.wav",
          mimeType: "audio/wav",
          sizeBytes: BigInt(1024),
          metadata: { durationMs: 15_000 },
          licenseStatus: "approved",
        },
      })
    ).id;

    imageAssetId = (
      await prisma.asset.create({
        data: {
          teamId,
          ownerId: userId,
          type: "image",
          name: "reference-api.png",
          storageUrl: "voflow/reference-api/reference-api.png",
          mimeType: "image/png",
          sizeBytes: BigInt(1024),
          metadata: { width: 1080 },
          licenseStatus: "approved",
        },
      })
    ).id;

    await prisma.assetConsent.create({
      data: {
        assetId: audioAssetId,
        teamId,
        userId,
        consentType: "asset_license",
        consentText: "reference api consent",
        usageScope: ["video_generation"],
      },
    });
  });

  afterEach(async () => {
    await prisma.asrSegment.deleteMany({
      where: {
        script: {
          referenceTranscriptSources: {
            some: {
              id: { in: referenceSourceIds },
            },
          },
        },
      },
    });
    await prisma.script.deleteMany({
      where: {
        referenceTranscriptSources: {
          some: {
            id: { in: referenceSourceIds },
          },
        },
      },
    });
    await prisma.referenceSource.deleteMany({ where: { id: { in: referenceSourceIds } } });
    await prisma.workflowNode.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.videoJob.deleteMany({ where: { id: { in: jobIds } } });
    await prisma.assetConsent.deleteMany({ where: { assetId: { in: [audioAssetId, imageAssetId] } } });
    await prisma.asset.deleteMany({ where: { id: { in: [audioAssetId, imageAssetId] } } });
    await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
    await prisma.teamMember.deleteMany({ where: { OR: [{ teamId }, { teamId: otherTeamId }, { userId }] } });
    await prisma.team.deleteMany({ where: { id: { in: [teamId, otherTeamId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    vi.restoreAllMocks();
    referenceSourceIds = [];
    jobIds = [];
  });

  it("creates a reference extraction task from an approved audio asset", async () => {
    const response = await createFromAsset(
      await createAuthenticatedRequest(`/api/projects/${projectId}/references/from-asset`, {
        assetId: audioAssetId,
      }),
      { params: Promise.resolve({ projectId }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "SUCCESS",
      message: "参考素材提取任务已创建",
      data: {
        referenceSource: {
          projectId,
          teamId,
          sourceType: "asset",
          assetId: audioAssetId,
          status: "transcribing",
          durationMs: 15_000,
        },
        job: {
          projectId,
          teamId,
          ownerId: userId,
          currentNode: "reference_extract",
        },
      },
    });
    referenceSourceIds.push(body.data.referenceSource.id);
    jobIds.push(body.data.job.id);
  });

  it("rejects non-audio-video assets for reference extraction", async () => {
    const response = await createFromAsset(
      await createAuthenticatedRequest(`/api/projects/${projectId}/references/from-asset`, {
        assetId: imageAssetId,
      }),
      { params: Promise.resolve({ projectId }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "REFERENCE_UNSUPPORTED_ASSET_TYPE",
      message: "仅支持音频或视频素材提取爆款参考。",
    });
  });

  it("returns a displayable fallback when reference URL parsing fails", async () => {
    const response = await createFromUrl(
      await createAuthenticatedRequest(`/api/projects/${projectId}/references/from-url`, {
        sourceUrl: "https://www.douyin.com/video/blocked",
      }),
      { params: Promise.resolve({ projectId }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "REFERENCE_PARSE_FAILED",
      message: "链接解析失败，请改用上传视频/音频或粘贴文案。",
      data: {
        platform: "douyin",
        fallback: {
          action: "upload_media_or_paste_text",
          message: "请上传视频/音频或直接粘贴文案继续提取。",
        },
      },
    });
  });

  it("creates a succeeded URL reference source when parser returns structure data", async () => {
    const originalParser = DEFAULT_REFERENCE_LINK_PARSERS.douyin;
    const parser: ReferenceLinkParser = {
      parse: vi.fn().mockResolvedValue({
        title: "高转化口播",
        durationMs: 35_000,
        raw: {
          structure: {
            hook: "开头三秒点出痛点",
            sellingPoints: ["真实案例", "限时利益"],
          },
        },
      }),
    };
    DEFAULT_REFERENCE_LINK_PARSERS.douyin = parser;

    try {
      const response = await createFromUrl(
        await createAuthenticatedRequest(`/api/projects/${projectId}/references/from-url`, {
          sourceUrl: "https://www.douyin.com/video/123",
        }),
        { params: Promise.resolve({ projectId }) }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        code: "SUCCESS",
        message: "参考链接已解析",
        data: {
          referenceSource: {
            projectId,
            teamId,
            sourceType: "url",
            platform: "douyin",
            sourceUrl: "https://www.douyin.com/video/123",
            status: "succeeded",
            durationMs: 35_000,
            structureJson: {
              title: "高转化口播",
              raw: {
                structure: {
                  hook: "开头三秒点出痛点",
                },
              },
            },
          },
        },
      });
      referenceSourceIds.push(body.data.referenceSource.id);
      expect(parser.parse).toHaveBeenCalledOnce();
    } finally {
      DEFAULT_REFERENCE_LINK_PARSERS.douyin = originalParser;
    }
  });

  it("returns reference source status, error, transcript, and structure for polling", async () => {
    const transcriptScript = await prisma.script.create({
      data: {
        projectId,
        sourceType: "asr",
        content: "第一句参考口播\n第二句成交提醒",
        version: 1,
        status: "draft",
      },
    });
    const referenceSource = await prisma.referenceSource.create({
      data: {
        projectId,
        teamId,
        sourceType: "asset",
        assetId: audioAssetId,
        status: "failed",
        durationMs: 15_000,
        transcriptScriptId: transcriptScript.id,
        structureJson: {
          hook: "第一句参考口播",
          rhythm: ["痛点", "方案"],
        },
        errorJson: {
          code: "REFERENCE_STRUCTURE_FAILED",
          message: "结构分析失败，请重试",
        },
      },
    });
    referenceSourceIds.push(referenceSource.id);

    const response = await getReference(await createAuthenticatedRequest(`/api/references/${referenceSource.id}`), {
      params: Promise.resolve({ referenceSourceId: referenceSource.id }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      data: {
        referenceSource: {
          id: referenceSource.id,
          status: "failed",
          errorJson: {
            code: "REFERENCE_STRUCTURE_FAILED",
            message: "结构分析失败，请重试",
          },
          transcript: "第一句参考口播\n第二句成交提醒",
          structureJson: {
            hook: "第一句参考口播",
            rhythm: ["痛点", "方案"],
          },
        },
      },
    });
  });

  it("lists project reference sources with transcript, structure, asset name, and team isolation", async () => {
    const transcriptScript = await prisma.script.create({
      data: {
        projectId,
        sourceType: "asr",
        content: "历史参考转写内容",
        version: 1,
        status: "draft",
      },
    });
    const olderReferenceSource = await prisma.referenceSource.create({
      data: {
        projectId,
        teamId,
        sourceType: "asset",
        assetId: audioAssetId,
        status: "succeeded",
        durationMs: 15_000,
        transcriptScriptId: transcriptScript.id,
        structureJson: {
          hook: "历史参考转写内容",
        },
        createdAt: new Date("2026-06-20T08:00:00.000Z"),
      },
    });
    const newerReferenceSource = await prisma.referenceSource.create({
      data: {
        projectId,
        teamId,
        sourceType: "url",
        platform: "douyin",
        sourceUrl: "https://www.douyin.com/video/newer",
        status: "failed",
        errorJson: {
          code: "REFERENCE_PARSE_FAILED",
          message: "链接解析失败",
        },
        createdAt: new Date("2026-06-20T09:00:00.000Z"),
      },
    });
    const otherProjectReferenceSource = await prisma.referenceSource.create({
      data: {
        projectId: otherProjectId,
        teamId: otherTeamId,
        sourceType: "url",
        sourceUrl: "https://www.douyin.com/video/other-project",
        status: "succeeded",
      },
    });
    referenceSourceIds.push(
      olderReferenceSource.id,
      newerReferenceSource.id,
      otherProjectReferenceSource.id
    );

    const response = await listReferences(
      await createAuthenticatedRequest(`/api/projects/${projectId}/references`),
      { params: Promise.resolve({ projectId }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "SUCCESS",
      data: {
        references: [
          {
            id: newerReferenceSource.id,
            projectId,
            teamId,
            sourceType: "url",
            platform: "douyin",
            sourceUrl: "https://www.douyin.com/video/newer",
            status: "failed",
            errorJson: {
              code: "REFERENCE_PARSE_FAILED",
            },
            transcript: null,
            asset: null,
          },
          {
            id: olderReferenceSource.id,
            projectId,
            teamId,
            sourceType: "asset",
            assetId: audioAssetId,
            status: "succeeded",
            transcript: "历史参考转写内容",
            structureJson: {
              hook: "历史参考转写内容",
            },
            asset: {
              id: audioAssetId,
              name: "reference-api.wav",
              type: "audio",
            },
          },
        ],
      },
    });
    expect(body.data.references.map((source: { id: string }) => source.id)).not.toContain(
      otherProjectReferenceSource.id
    );
  });

  it("does not expose reference sources from another team", async () => {
    const otherReferenceSource = await prisma.referenceSource.create({
      data: {
        projectId: otherProjectId,
        teamId: otherTeamId,
        sourceType: "url",
        sourceUrl: "https://www.douyin.com/video/other",
        status: "succeeded",
      },
    });
    referenceSourceIds.push(otherReferenceSource.id);

    const response = await getReference(await createAuthenticatedRequest(`/api/references/${otherReferenceSource.id}`), {
      params: Promise.resolve({ referenceSourceId: otherReferenceSource.id }),
    });

    expect(response.status).toBe(404);
  });

  it("retries a failed asset reference on the same reference source", async () => {
    const failedReferenceSource = await prisma.referenceSource.create({
      data: {
        projectId,
        teamId,
        sourceType: "asset",
        assetId: audioAssetId,
        status: "failed",
        durationMs: 15_000,
        errorJson: {
          code: "REFERENCE_ASR_FAILED",
          message: "ASR 转写失败",
        },
      },
    });
    referenceSourceIds.push(failedReferenceSource.id);

    const response = await retryReference(
      await createAuthenticatedRequest(
        `/api/references/${failedReferenceSource.id}/retry`,
        undefined,
        "POST"
      ),
      { params: Promise.resolve({ referenceSourceId: failedReferenceSource.id }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "SUCCESS",
      message: "参考来源重试任务已创建",
      data: {
        referenceSource: {
          id: failedReferenceSource.id,
          projectId,
          teamId,
          sourceType: "asset",
          assetId: audioAssetId,
          status: "transcribing",
          errorJson: null,
        },
        job: {
          projectId,
          teamId,
          ownerId: userId,
          currentNode: "reference_extract",
        },
        node: {
          nodeType: "reference_extract",
          status: "queued",
          input: {
            sourceType: "asset",
            projectId,
            teamId,
            referenceSourceId: failedReferenceSource.id,
            assetId: audioAssetId,
            assetType: "audio",
          },
        },
      },
    });
    jobIds.push(body.data.job.id);
    await expect(
      prisma.referenceSource.count({
        where: {
          projectId,
          teamId,
        },
      })
    ).resolves.toBe(1);
  });

  it("rejects retry for reference sources that are not failed", async () => {
    const referenceSource = await prisma.referenceSource.create({
      data: {
        projectId,
        teamId,
        sourceType: "asset",
        assetId: audioAssetId,
        status: "transcribing",
        durationMs: 15_000,
      },
    });
    referenceSourceIds.push(referenceSource.id);

    const response = await retryReference(
      await createAuthenticatedRequest(`/api/references/${referenceSource.id}/retry`, undefined, "POST"),
      { params: Promise.resolve({ referenceSourceId: referenceSource.id }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "REFERENCE_RETRY_NOT_ALLOWED",
      message: "仅失败的参考来源可以重试",
    });
  });

  it("retries a failed URL reference on the same reference source", async () => {
    const originalParser = DEFAULT_REFERENCE_LINK_PARSERS.douyin;
    const parser: ReferenceLinkParser = {
      parse: vi.fn().mockResolvedValue({
        title: "重试后的结构",
        durationMs: 22_000,
        raw: {
          structure: {
            hook: "重试后开头",
          },
        },
      }),
    };
    DEFAULT_REFERENCE_LINK_PARSERS.douyin = parser;

    try {
      const failedReferenceSource = await prisma.referenceSource.create({
        data: {
          projectId,
          teamId,
          sourceType: "url",
          platform: "douyin",
          sourceUrl: "https://www.douyin.com/video/retry",
          status: "failed",
          errorJson: {
            code: "REFERENCE_PARSE_FAILED",
            message: "链接解析失败",
          },
        },
      });
      referenceSourceIds.push(failedReferenceSource.id);

      const response = await retryReference(
        await createAuthenticatedRequest(
          `/api/references/${failedReferenceSource.id}/retry`,
          undefined,
          "POST"
        ),
        { params: Promise.resolve({ referenceSourceId: failedReferenceSource.id }) }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        code: "SUCCESS",
        message: "参考链接已重新解析",
        data: {
          referenceSource: {
            id: failedReferenceSource.id,
            projectId,
            teamId,
            sourceType: "url",
            platform: "douyin",
            sourceUrl: "https://www.douyin.com/video/retry",
            status: "succeeded",
            durationMs: 22_000,
            errorJson: null,
            structureJson: {
              title: "重试后的结构",
              raw: {
                structure: {
                  hook: "重试后开头",
                },
              },
            },
          },
        },
      });
      await expect(
        prisma.referenceSource.count({
          where: {
            projectId,
            teamId,
          },
        })
      ).resolves.toBe(1);
      expect(parser.parse).toHaveBeenCalledOnce();
    } finally {
      DEFAULT_REFERENCE_LINK_PARSERS.douyin = originalParser;
    }
  });

  it("does not retry reference sources from another team", async () => {
    const otherReferenceSource = await prisma.referenceSource.create({
      data: {
        projectId: otherProjectId,
        teamId: otherTeamId,
        sourceType: "url",
        sourceUrl: "https://www.douyin.com/video/other-retry",
        status: "failed",
      },
    });
    referenceSourceIds.push(otherReferenceSource.id);

    const response = await retryReference(
      await createAuthenticatedRequest(
        `/api/references/${otherReferenceSource.id}/retry`,
        undefined,
        "POST"
      ),
      { params: Promise.resolve({ referenceSourceId: otherReferenceSource.id }) }
    );

    expect(response.status).toBe(404);
  });

  async function createAuthenticatedRequest(
    path: string,
    body?: unknown,
    method = body === undefined ? "GET" : "POST"
  ): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      teamId,
      email: "reference-api@example.com",
      name: "Reference API User",
    });

    return new NextRequest(`http://localhost:3000${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        cookie: `session=${token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
});
