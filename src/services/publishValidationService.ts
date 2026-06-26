import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  serializeChannelAccount,
  type ChannelAccountRecord,
  type SerializedChannelAccount,
} from "@/lib/publish/channel-account";
import {
  PUBLISH_PLATFORMS,
  getPublishPlatformRule,
  type PublishAspectRatio,
  type PublishPlatform,
} from "@/lib/publish/rules";
import { readStringArray } from "@/lib/publish/serializer";
import {
  PUBLISH_VALIDATION_CHECK_CODES,
  PUBLISH_VALIDATION_ERROR_CODES,
  type PublishPlatformValidationResult,
  type PublishValidationCheck,
  type PublishValidationPayload,
} from "@/lib/publish/validation";
import { getChannelAccountsForUser } from "@/services/channelAccountService";

export interface ValidatePublishInput {
  jobId: string;
  teamId: string;
  userId: string;
  platforms?: PublishPlatform[];
  now?: Date;
}

export type ValidatePublishResult =
  | {
      success: true;
      data: PublishValidationPayload;
    }
  | {
      success: false;
      error: {
        code: typeof PUBLISH_VALIDATION_ERROR_CODES.jobNotFound;
        message: string;
      };
    };

interface DraftForValidation {
  id: string;
  jobId: string;
  platform: PublishPlatform;
  title: string;
  tagsJson: unknown;
  coverArtifactId: string | null;
  coverArtifact: {
    id: string;
    metadata: unknown;
  } | null;
}

interface ArtifactForValidation {
  id: string;
  metadata: unknown;
}

const PUBLISH_DRAFT_VALIDATION_SELECT = {
  id: true,
  jobId: true,
  platform: true,
  title: true,
  tagsJson: true,
  coverArtifactId: true,
  coverArtifact: {
    select: {
      id: true,
      metadata: true,
    },
  },
} satisfies Prisma.PublishDraftSelect;

export async function validatePublishParameters(
  input: ValidatePublishInput
): Promise<ValidatePublishResult> {
  const now = input.now ?? new Date();
  const job = await prisma.videoJob.findFirst({
    where: {
      id: input.jobId,
      teamId: input.teamId,
    },
    select: {
      id: true,
    },
  });

  if (!job) {
    return {
      success: false,
      error: {
        code: PUBLISH_VALIDATION_ERROR_CODES.jobNotFound,
        message: "视频任务不存在",
      },
    };
  }

  const [drafts, finalVideoArtifact, accountResult] = await Promise.all([
    prisma.publishDraft.findMany({
      where: {
        jobId: input.jobId,
        ...(input.platforms ? { platform: { in: input.platforms } } : {}),
      },
      select: PUBLISH_DRAFT_VALIDATION_SELECT,
    }),
    prisma.artifact.findFirst({
      where: {
        jobId: input.jobId,
        type: "final_video",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        metadata: true,
      },
    }),
    getChannelAccountsForUser({
      teamId: input.teamId,
      userId: input.userId,
      now,
    }),
  ]);

  const draftByPlatform = new Map<PublishPlatform, DraftForValidation>();
  for (const draft of drafts) {
    draftByPlatform.set(draft.platform, draft as DraftForValidation);
  }

  const accountByPlatform = new Map<PublishPlatform, SerializedChannelAccount>();
  for (const account of accountResult.data.accounts) {
    accountByPlatform.set(account.platform, account);
  }

  const targetPlatforms = input.platforms ?? sortPlatforms(Array.from(draftByPlatform.keys()));
  const checkedAt = now.toISOString();
  const results = targetPlatforms.map((platform) =>
    validatePlatform({
      platform,
      checkedAt,
      draft: draftByPlatform.get(platform) ?? null,
      finalVideoArtifact: finalVideoArtifact as ArtifactForValidation | null,
      account:
        accountByPlatform.get(platform) ??
        serializeChannelAccount(platform, null as ChannelAccountRecord | null, now),
    })
  );

  await Promise.all(
    results
      .filter((result): result is PublishPlatformValidationResult & { draftId: string } =>
        Boolean(result.draftId)
      )
      .map((result) =>
        prisma.publishDraft.update({
          where: {
            id: result.draftId,
          },
          data: {
            validationJson: toPrismaJson(result),
          },
        })
      )
  );

  const passed = results.filter((result) => result.passed).length;

  return {
    success: true,
    data: {
      summary: {
        total: results.length,
        passed,
        failed: results.length - passed,
        canPublish: results.length > 0 && passed === results.length,
      },
      results,
    },
  };
}

function validatePlatform(input: {
  platform: PublishPlatform;
  checkedAt: string;
  draft: DraftForValidation | null;
  finalVideoArtifact: ArtifactForValidation | null;
  account: SerializedChannelAccount;
}): PublishPlatformValidationResult {
  if (!input.draft) {
    const checks = [
      failCheck("draft", PUBLISH_VALIDATION_CHECK_CODES.draftMissing, "发布草稿不存在"),
    ];

    return buildValidationResult(input, null, null, checks);
  }

  const rule = getPublishPlatformRule(input.platform);
  const checks: PublishValidationCheck[] = [];
  const titleLength = Array.from(input.draft.title.trim()).length;
  if (titleLength === 0) {
    checks.push(failCheck("title", PUBLISH_VALIDATION_CHECK_CODES.titleRequired, "标题不能为空"));
  } else if (titleLength > rule.title.maxChars) {
    checks.push(
      failCheck("title", PUBLISH_VALIDATION_CHECK_CODES.titleTooLong, "标题超过平台限制", {
        actual: titleLength,
        limit: rule.title.maxChars,
      })
    );
  } else {
    checks.push(
      passCheck("title", PUBLISH_VALIDATION_CHECK_CODES.titleValid, "标题符合平台限制", {
        actual: titleLength,
        limit: rule.title.maxChars,
      })
    );
  }

  const tags = readStringArray(input.draft.tagsJson);
  if (tags.length > rule.tags.maxCount) {
    checks.push(
      failCheck("tags", PUBLISH_VALIDATION_CHECK_CODES.tagsTooMany, "标签数量超过平台限制", {
        actual: tags.length,
        limit: rule.tags.maxCount,
      })
    );
  } else {
    checks.push(
      passCheck("tags", PUBLISH_VALIDATION_CHECK_CODES.tagsValid, "标签数量符合平台限制", {
        actual: tags.length,
        limit: rule.tags.maxCount,
      })
    );
  }

  if (!input.draft.coverArtifact) {
    checks.push(
      failCheck("cover", PUBLISH_VALIDATION_CHECK_CODES.coverRequired, "封面素材不能为空")
    );
  } else {
    const coverRatio = readAspectRatio(input.draft.coverArtifact.metadata);
    if (coverRatio && rule.cover.allowedAspectRatios.includes(coverRatio)) {
      checks.push(
        passCheck("cover", PUBLISH_VALIDATION_CHECK_CODES.coverRatioValid, "封面比例符合平台限制", {
          actual: coverRatio,
          limit: rule.cover.allowedAspectRatios,
        })
      );
    } else {
      checks.push(
        failCheck(
          "cover",
          PUBLISH_VALIDATION_CHECK_CODES.coverRatioUnsupported,
          "封面比例不符合平台限制",
          {
            actual: coverRatio,
            limit: rule.cover.allowedAspectRatios,
          }
        )
      );
    }
  }

  if (!input.finalVideoArtifact) {
    checks.push(
      failCheck(
        "finalVideo",
        PUBLISH_VALIDATION_CHECK_CODES.finalVideoNotReady,
        "最终视频尚未生成"
      )
    );
  } else {
    checks.push(
      passCheck("finalVideo", PUBLISH_VALIDATION_CHECK_CODES.finalVideoReady, "最终视频已生成")
    );

    const videoRatio = readAspectRatio(input.finalVideoArtifact.metadata);
    if (videoRatio && rule.video.allowedAspectRatios.includes(videoRatio)) {
      checks.push(
        passCheck(
          "videoRatio",
          PUBLISH_VALIDATION_CHECK_CODES.videoRatioValid,
          "视频比例符合平台限制",
          {
            actual: videoRatio,
            limit: rule.video.allowedAspectRatios,
          }
        )
      );
    } else {
      checks.push(
        failCheck(
          "videoRatio",
          PUBLISH_VALIDATION_CHECK_CODES.videoRatioUnsupported,
          "视频比例不符合平台限制",
          {
            actual: videoRatio,
            limit: rule.video.allowedAspectRatios,
          }
        )
      );
    }

    const durationSeconds = readDurationSeconds(input.finalVideoArtifact.metadata);
    if (durationSeconds === null) {
      checks.push(
        failCheck(
          "videoDuration",
          PUBLISH_VALIDATION_CHECK_CODES.videoDurationMissing,
          "无法读取视频时长"
        )
      );
    } else if (
      durationSeconds < rule.video.minDurationSeconds ||
      durationSeconds > rule.video.maxDurationSeconds
    ) {
      checks.push(
        failCheck(
          "videoDuration",
          PUBLISH_VALIDATION_CHECK_CODES.videoDurationOutOfRange,
          "视频时长不符合平台限制",
          {
            actual: durationSeconds,
            limit: `${rule.video.minDurationSeconds}-${rule.video.maxDurationSeconds}`,
          }
        )
      );
    } else {
      checks.push(
        passCheck(
          "videoDuration",
          PUBLISH_VALIDATION_CHECK_CODES.videoDurationValid,
          "视频时长符合平台限制",
          {
            actual: durationSeconds,
            limit: `${rule.video.minDurationSeconds}-${rule.video.maxDurationSeconds}`,
          }
        )
      );
    }
  }

  const accountStatus = input.account.status;
  if (accountStatus === "connected" && !input.account.requiresAuth) {
    checks.push(
      passCheck(
        "channelAccount",
        PUBLISH_VALIDATION_CHECK_CODES.channelAccountConnected,
        "渠道账号已授权"
      )
    );
  } else if (accountStatus === "expired") {
    checks.push(
      failCheck(
        "channelAccount",
        PUBLISH_VALIDATION_CHECK_CODES.channelTokenExpired,
        "渠道授权已过期"
      )
    );
  } else {
    checks.push(
      failCheck(
        "channelAccount",
        PUBLISH_VALIDATION_CHECK_CODES.channelAccountNotConnected,
        "渠道账号未授权"
      )
    );
  }

  return buildValidationResult(
    input,
    input.draft.id,
    input.draft.coverArtifactId,
    checks
  );
}

function buildValidationResult(
  input: {
    platform: PublishPlatform;
    checkedAt: string;
    finalVideoArtifact: ArtifactForValidation | null;
    account: SerializedChannelAccount;
  },
  draftId: string | null,
  coverArtifactId: string | null,
  checks: PublishValidationCheck[]
): PublishPlatformValidationResult {
  return {
    draftId,
    platform: input.platform,
    passed: checks.every((check) => check.passed),
    checkedAt: input.checkedAt,
    account: input.account,
    finalVideoArtifactId: input.finalVideoArtifact?.id ?? null,
    coverArtifactId,
    checks,
  };
}

function passCheck(
  field: PublishValidationCheck["field"],
  code: PublishValidationCheck["code"],
  message: string,
  details: Pick<PublishValidationCheck, "actual" | "limit"> = {}
): PublishValidationCheck {
  return {
    field,
    code,
    passed: true,
    message,
    ...details,
  };
}

function failCheck(
  field: PublishValidationCheck["field"],
  code: PublishValidationCheck["code"],
  message: string,
  details: Pick<PublishValidationCheck, "actual" | "limit"> = {}
): PublishValidationCheck {
  return {
    field,
    code,
    passed: false,
    message,
    ...details,
  };
}

function readAspectRatio(metadata: unknown): PublishAspectRatio | null {
  if (!isRecord(metadata)) return null;

  if (typeof metadata.aspectRatio === "string" && isPublishAspectRatio(metadata.aspectRatio)) {
    return metadata.aspectRatio;
  }

  const width = readFiniteNumber(metadata.width ?? metadata.videoWidth);
  const height = readFiniteNumber(metadata.height ?? metadata.videoHeight);
  if (!width || !height) return null;

  return resolveAspectRatio(width, height);
}

function readDurationSeconds(metadata: unknown): number | null {
  if (!isRecord(metadata)) return null;

  const durationSeconds = readFiniteNumber(metadata.durationSeconds);
  if (durationSeconds !== null) {
    return durationSeconds;
  }

  const durationMs = readFiniteNumber(metadata.durationMs);
  if (durationMs !== null) {
    return durationMs / 1000;
  }

  const duration = readFiniteNumber(metadata.duration);
  return duration;
}

function resolveAspectRatio(width: number, height: number): PublishAspectRatio | null {
  const ratio = width / height;
  const candidates: Array<{ ratio: PublishAspectRatio; value: number }> = [
    { ratio: "9:16", value: 9 / 16 },
    { ratio: "16:9", value: 16 / 9 },
    { ratio: "1:1", value: 1 },
    { ratio: "3:4", value: 3 / 4 },
    { ratio: "4:3", value: 4 / 3 },
    { ratio: "16:10", value: 16 / 10 },
  ];

  const matched = candidates.find((candidate) => Math.abs(candidate.value - ratio) < 0.02);
  return matched?.ratio ?? null;
}

function isPublishAspectRatio(value: string): value is PublishAspectRatio {
  return ["9:16", "16:9", "1:1", "3:4", "4:3", "16:10"].includes(value);
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortPlatforms(platforms: PublishPlatform[]): PublishPlatform[] {
  return platforms.sort((a, b) => PUBLISH_PLATFORMS.indexOf(a) - PUBLISH_PLATFORMS.indexOf(b));
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
