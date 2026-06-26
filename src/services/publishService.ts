import type { ChannelAccount, Prisma, PublishStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getChannelAdapter } from "@/lib/publish/channel-adapter";
import { getChannelAccountDisplayStatus } from "@/lib/publish/channel-account";
import {
  PUBLISH_ERROR_CODES,
  PUBLISH_SKIP_CODES,
  buildPublishRetryErrorHistory,
  readPublishValidationSnapshot,
  serializePublish,
  summarizePublishes,
  type PublishRecordForSerialization,
  type SerializedPublish,
} from "@/lib/publish/publish";
import { PUBLISH_PLATFORMS, type PublishPlatform } from "@/lib/publish/rules";
import { readStringArray } from "@/lib/publish/serializer";

export interface CreatePublishesInput {
  jobId: string;
  teamId: string;
  userId: string;
  platforms?: PublishPlatform[];
  now?: Date;
}

export interface RetryPublishInput {
  publishId: string;
  teamId: string;
  userId: string;
  now?: Date;
}

export type CreatePublishesResult =
  | {
      success: true;
      data: {
        summary: ReturnType<typeof summarizePublishes>;
        publishes: SerializedPublish[];
      };
    }
  | {
      success: false;
      error: {
        code:
          | typeof PUBLISH_ERROR_CODES.jobNotFound
          | typeof PUBLISH_ERROR_CODES.draftMissing;
        message: string;
      };
    };

export type RetryPublishResult =
  | {
      success: true;
      data: {
        publish: SerializedPublish;
      };
    }
  | {
      success: false;
      error: {
        code:
          | typeof PUBLISH_ERROR_CODES.publishNotFound
          | typeof PUBLISH_ERROR_CODES.retryNotAllowed
          | typeof PUBLISH_ERROR_CODES.validationFailed;
        message: string;
      };
    };

interface PublishDraftForCreation {
  id: string;
  jobId: string;
  platform: PublishPlatform;
  title: string;
  description: string;
  tagsJson: unknown;
  topicsJson: unknown;
  coverArtifactId: string | null;
  validationJson: unknown;
}

interface PublishForRetry {
  id: string;
  jobId: string;
  publishDraftId: string;
  channelAccountId: string;
  platform: PublishPlatform;
  status: PublishStatus;
  requestId: string | null;
  remoteId: string | null;
  errorJson: unknown;
  publishDraft: PublishDraftForCreation;
  channelAccount: {
    id: string;
    status: "connected" | "expired" | "revoked" | "not_connected";
    expiresAt: Date | null;
  };
}

const PUBLISH_DRAFT_FOR_CREATION_SELECT = {
  id: true,
  jobId: true,
  platform: true,
  title: true,
  description: true,
  tagsJson: true,
  topicsJson: true,
  coverArtifactId: true,
  validationJson: true,
} satisfies Prisma.PublishDraftSelect;

const PUBLISH_RECORD_SELECT = {
  id: true,
  jobId: true,
  publishDraftId: true,
  channelAccountId: true,
  platform: true,
  status: true,
  requestId: true,
  remoteId: true,
  errorJson: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PublishSelect;

export async function createPublishesForJob(
  input: CreatePublishesInput
): Promise<CreatePublishesResult> {
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
        code: PUBLISH_ERROR_CODES.jobNotFound,
        message: "视频任务不存在",
      },
    };
  }

  const drafts = await prisma.publishDraft.findMany({
    where: {
      jobId: input.jobId,
      ...(input.platforms ? { platform: { in: input.platforms } } : {}),
    },
    select: PUBLISH_DRAFT_FOR_CREATION_SELECT,
  });

  const draftByPlatform = new Map<PublishPlatform, PublishDraftForCreation>();
  for (const draft of drafts) {
    draftByPlatform.set(draft.platform, draft as PublishDraftForCreation);
  }

  const targetPlatforms = input.platforms ?? sortPlatforms(Array.from(draftByPlatform.keys()));
  const missingPlatform = targetPlatforms.find((platform) => !draftByPlatform.has(platform));
  if (missingPlatform) {
    return {
      success: false,
      error: {
        code: PUBLISH_ERROR_CODES.draftMissing,
        message: "发布草稿不存在",
      },
    };
  }

  const [accounts, finalVideoArtifact] = await Promise.all([
    prisma.channelAccount.findMany({
      where: {
        teamId: input.teamId,
        userId: input.userId,
        platform: { in: targetPlatforms },
      },
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
      },
    }),
  ]);

  const accountByPlatform = new Map<PublishPlatform, ChannelAccount>();
  for (const account of accounts) {
    accountByPlatform.set(account.platform, account);
  }

  const savedPublishes: SerializedPublish[] = [];
  for (const platform of targetPlatforms) {
    const draft = draftByPlatform.get(platform);
    if (!draft) continue;

    const account = await resolvePublishChannelAccount({
      teamId: input.teamId,
      userId: input.userId,
      platform,
      account: accountByPlatform.get(platform) ?? null,
    });
    accountByPlatform.set(platform, account);

    const validation = readPublishValidationSnapshot(draft.validationJson, platform);
    const displayStatus = getChannelAccountDisplayStatus(account, now);
    const skipReason = resolveSkipReason({
      validation,
      channelAccountStatus: displayStatus,
      hasFinalVideoArtifact: Boolean(finalVideoArtifact),
    });

    if (skipReason) {
      const skipped = await createPublishRecord({
        jobId: input.jobId,
        publishDraftId: draft.id,
        channelAccountId: account.id,
        platform,
        status: "skipped",
        requestId: null,
        remoteId: null,
        errorJson: skipReason,
      });
      savedPublishes.push(skipped);
      continue;
    }

    const adapter = getChannelAdapter(platform);
    const uploadResult = await adapter.uploadVideo({
      platform,
      publishDraftId: draft.id,
      channelAccountId: account.id,
      finalVideoArtifactId: finalVideoArtifact!.id,
      title: draft.title,
      description: draft.description,
      tags: readStringArray(draft.tagsJson),
      topics: readStringArray(draft.topicsJson),
      coverArtifactId: draft.coverArtifactId,
      validationJson: validation!,
    });

    if (!uploadResult.success) {
      const failed = await createPublishRecord({
        jobId: input.jobId,
        publishDraftId: draft.id,
        channelAccountId: account.id,
        platform,
        status: "failed",
        requestId: null,
        remoteId: null,
        errorJson: uploadResult.error,
      });
      savedPublishes.push(failed);
      continue;
    }

    const publishResult = await adapter.publish({
      platform,
      publishDraftId: draft.id,
      channelAccountId: account.id,
      finalVideoArtifactId: finalVideoArtifact!.id,
      title: draft.title,
      description: draft.description,
      tags: readStringArray(draft.tagsJson),
      topics: readStringArray(draft.topicsJson),
      coverArtifactId: draft.coverArtifactId,
      validationJson: validation!,
      remoteVideoId: uploadResult.data.remoteVideoId,
    });

    const saved = await createPublishRecord({
      jobId: input.jobId,
      publishDraftId: draft.id,
      channelAccountId: account.id,
      platform,
      status: publishResult.success ? publishResult.data.status : "failed",
      requestId: publishResult.success ? publishResult.data.requestId : null,
      remoteId: publishResult.success ? publishResult.data.remotePublishId : null,
      errorJson: publishResult.success ? null : publishResult.error,
    });
    savedPublishes.push(saved);
  }

  return {
    success: true,
    data: {
      summary: summarizePublishes(savedPublishes),
      publishes: savedPublishes,
    },
  };
}

export async function retryPublish(input: RetryPublishInput): Promise<RetryPublishResult> {
  const now = input.now ?? new Date();
  const publish = await prisma.publish.findFirst({
    where: {
      id: input.publishId,
      job: {
        teamId: input.teamId,
      },
      channelAccount: {
        userId: input.userId,
      },
    },
    select: {
      id: true,
      jobId: true,
      publishDraftId: true,
      channelAccountId: true,
      platform: true,
      status: true,
      requestId: true,
      remoteId: true,
      errorJson: true,
      publishDraft: {
        select: PUBLISH_DRAFT_FOR_CREATION_SELECT,
      },
      channelAccount: {
        select: {
          id: true,
          status: true,
          expiresAt: true,
        },
      },
    },
  });

  if (!publish) {
    return {
      success: false,
      error: {
        code: PUBLISH_ERROR_CODES.publishNotFound,
        message: "发布记录不存在",
      },
    };
  }

  const publishForRetry = publish as PublishForRetry;
  if (publishForRetry.status !== "failed") {
    return {
      success: false,
      error: {
        code: PUBLISH_ERROR_CODES.retryNotAllowed,
        message: "只有失败的发布记录可以重试",
      },
    };
  }

  const validation = readPublishValidationSnapshot(
    publishForRetry.publishDraft.validationJson,
    publishForRetry.platform
  );
  const finalVideoArtifact = await prisma.artifact.findFirst({
    where: {
      jobId: publishForRetry.jobId,
      type: "final_video",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
    },
  });
  const skipReason = resolveSkipReason({
    validation,
    channelAccountStatus: getChannelAccountDisplayStatus(publishForRetry.channelAccount, now),
    hasFinalVideoArtifact: Boolean(finalVideoArtifact),
  });

  if (skipReason) {
    return {
      success: false,
      error: {
        code: PUBLISH_ERROR_CODES.validationFailed,
        message: skipReason.message,
      },
    };
  }

  const previousRequestId = publishForRetry.requestId ?? publishForRetry.id;
  const retryResult = await getChannelAdapter(publishForRetry.platform).retry({
    platform: publishForRetry.platform,
    publishDraftId: publishForRetry.publishDraftId,
    channelAccountId: publishForRetry.channelAccountId,
    finalVideoArtifactId: finalVideoArtifact!.id,
    title: publishForRetry.publishDraft.title,
    description: publishForRetry.publishDraft.description,
    tags: readStringArray(publishForRetry.publishDraft.tagsJson),
    topics: readStringArray(publishForRetry.publishDraft.topicsJson),
    coverArtifactId: publishForRetry.publishDraft.coverArtifactId,
    validationJson: validation!,
    remoteVideoId: `mock-video-${publishForRetry.platform}-${finalVideoArtifact!.id}`,
    previousRequestId,
  });

  const retryRequestId = retryResult.success ? retryResult.data.requestId : null;
  const retryRemoteId = retryResult.success ? retryResult.data.remotePublishId : null;
  const errorJson = buildPublishRetryErrorHistory({
    previousStatus: "failed",
    previousRequestId: publishForRetry.requestId,
    previousRemoteId: publishForRetry.remoteId,
    previousErrorJson: publishForRetry.errorJson,
    retryPreviousRequestId: previousRequestId,
    retryRequestId,
    retryRemoteId,
    ...(retryResult.success ? {} : { currentError: retryResult.error }),
  });

  const saved = await prisma.publish.update({
    where: {
      id: publishForRetry.id,
    },
    data: {
      status: retryResult.success ? retryResult.data.status : "failed",
      requestId: retryResult.success ? retryResult.data.requestId : publishForRetry.requestId,
      remoteId: retryResult.success ? retryResult.data.remotePublishId : publishForRetry.remoteId,
      errorJson: toPrismaJson(errorJson),
    },
    select: PUBLISH_RECORD_SELECT,
  });

  return {
    success: true,
    data: {
      publish: serializePublish(saved as PublishRecordForSerialization),
    },
  };
}

async function resolvePublishChannelAccount(input: {
  teamId: string;
  userId: string;
  platform: PublishPlatform;
  account: ChannelAccount | null;
}): Promise<ChannelAccount> {
  if (input.account) {
    return input.account;
  }

  return prisma.channelAccount.create({
    data: {
      teamId: input.teamId,
      userId: input.userId,
      platform: input.platform,
      status: "not_connected",
    },
  });
}

function resolveSkipReason(input: {
  validation: ReturnType<typeof readPublishValidationSnapshot>;
  channelAccountStatus: "connected" | "expired" | "not_connected";
  hasFinalVideoArtifact: boolean;
}): { code: string; message: string } | null {
  if (input.channelAccountStatus === "expired") {
    return {
      code: PUBLISH_SKIP_CODES.channelTokenExpired,
      message: "渠道账号不可发布",
    };
  }

  if (input.channelAccountStatus === "not_connected") {
    return {
      code: PUBLISH_SKIP_CODES.channelAccountNotConnected,
      message: "渠道账号不可发布",
    };
  }

  if (!input.validation?.passed || !input.hasFinalVideoArtifact) {
    return {
      code: readFirstFailedValidationCode(input.validation) ?? PUBLISH_SKIP_CODES.validationFailed,
      message: "发布参数检查未通过",
    };
  }

  return null;
}

function readFirstFailedValidationCode(
  validation: ReturnType<typeof readPublishValidationSnapshot>
): string | null {
  const failed = validation?.checks.find((check) => !check.passed);
  return failed?.code ?? null;
}

async function createPublishRecord(input: {
  jobId: string;
  publishDraftId: string;
  channelAccountId: string;
  platform: PublishPlatform;
  status: PublishStatus;
  requestId: string | null;
  remoteId: string | null;
  errorJson: unknown;
}): Promise<SerializedPublish> {
  const record = await prisma.publish.create({
    data: {
      jobId: input.jobId,
      publishDraftId: input.publishDraftId,
      channelAccountId: input.channelAccountId,
      platform: input.platform,
      status: input.status,
      requestId: input.requestId,
      remoteId: input.remoteId,
      errorJson: input.errorJson === null ? undefined : toPrismaJson(input.errorJson),
    },
    select: PUBLISH_RECORD_SELECT,
  });

  return serializePublish(record as PublishRecordForSerialization);
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function sortPlatforms(platforms: PublishPlatform[]): PublishPlatform[] {
  return [...platforms].sort(
    (a, b) => PUBLISH_PLATFORMS.indexOf(a) - PUBLISH_PLATFORMS.indexOf(b)
  );
}
