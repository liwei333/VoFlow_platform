import type { Prisma, PublishStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getChannelAdapter, type PublishChannelAdapter } from "@/lib/publish/channel-adapter";
import { buildPublishRealPlatformConfig, type PublishRealPlatformEnv } from "@/lib/publish/config";
import {
  PUBLISH_ERROR_CODES,
  serializePublish,
  type PublishRecordForSerialization,
  type SerializedPublish,
} from "@/lib/publish/publish";
import {
  decryptChannelToken,
  requireChannelTokenSecret,
  type ChannelTokenEnv,
} from "@/lib/publish/token";

export const PUBLISH_STATUS_SYNC_ERROR_CODES = {
  statusSyncFailed: "PUBLISH_STATUS_SYNC_FAILED",
} as const;

export interface SyncPublishStatusInput {
  publishId: string;
  teamId: string;
  userId: string;
  now?: Date;
}

export interface SyncPublishStatusDependencies {
  adapter: PublishChannelAdapter;
}

export interface SyncPublishStatusForUserOptions {
  env?: PublishRealPlatformEnv & ChannelTokenEnv;
  fetchImpl?: typeof fetch;
}

export type SyncPublishStatusResult =
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
          | typeof PUBLISH_STATUS_SYNC_ERROR_CODES.statusSyncFailed;
        message: string;
      };
    };

const PUBLISH_SYNC_RECORD_SELECT = {
  id: true,
  jobId: true,
  publishDraftId: true,
  channelAccountId: true,
  platform: true,
  status: true,
  requestId: true,
  remoteId: true,
  remoteUrl: true,
  remoteStatus: true,
  lastSyncedAt: true,
  attemptsJson: true,
  errorJson: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PublishSelect;

export async function syncPublishStatus(
  input: SyncPublishStatusInput,
  dependencies: SyncPublishStatusDependencies
): Promise<SyncPublishStatusResult> {
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
    select: PUBLISH_SYNC_RECORD_SELECT,
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

  const syncResult = await dependencies.adapter.getStatus({
    platform: publish.platform,
    requestId: publish.requestId ?? publish.id,
    remotePublishId: publish.remoteId,
  });

  if (!syncResult.success) {
    const sanitizedError = buildStatusSyncError();
    const saved = await prisma.publish.update({
      where: {
        id: publish.id,
      },
      data: {
        status: "failed",
        lastSyncedAt: now,
        errorJson: sanitizedError,
      },
      select: PUBLISH_SYNC_RECORD_SELECT,
    });

    return {
      success: false,
      error: {
        code: PUBLISH_STATUS_SYNC_ERROR_CODES.statusSyncFailed,
        message: readStatusSyncErrorMessage(
          serializePublish(saved as PublishRecordForSerialization).errorJson
        ),
      },
    };
  }

  const saved = await prisma.publish.update({
    where: {
      id: publish.id,
    },
    data: {
      status: syncResult.data.status as PublishStatus,
      requestId: syncResult.data.requestId,
      remoteId: syncResult.data.remotePublishId,
      remoteUrl: syncResult.data.remoteUrl ?? null,
      remoteStatus:
        syncResult.data.remoteStatus === undefined
          ? undefined
          : (syncResult.data.remoteStatus as Prisma.InputJsonValue),
      lastSyncedAt: now,
      errorJson:
        syncResult.data.status === "failed" && publish.errorJson !== null
          ? (publish.errorJson as Prisma.InputJsonValue)
          : undefined,
    },
    select: PUBLISH_SYNC_RECORD_SELECT,
  });

  return {
    success: true,
    data: {
      publish: serializePublish(saved as PublishRecordForSerialization),
    },
  };
}

function buildStatusSyncError(): Prisma.InputJsonObject {
  return {
    code: PUBLISH_STATUS_SYNC_ERROR_CODES.statusSyncFailed,
    message: "发布状态同步失败",
  };
}

function readStatusSyncErrorMessage(errorJson: unknown): string {
  if (!errorJson || typeof errorJson !== "object" || Array.isArray(errorJson)) {
    return "发布状态同步失败";
  }

  const message = (errorJson as { message?: unknown }).message;
  return typeof message === "string" ? message : "发布状态同步失败";
}

export async function syncPublishStatusForUser(
  input: SyncPublishStatusInput,
  options: SyncPublishStatusForUserOptions = {}
): Promise<SyncPublishStatusResult> {
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
      platform: true,
      channelAccount: {
        select: {
          encryptedAccessToken: true,
          encryptedToken: true,
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

  try {
    const config = buildPublishRealPlatformConfig(options.env);
    const encryptedAccessToken =
      publish.channelAccount.encryptedAccessToken ?? publish.channelAccount.encryptedToken;
    if (!encryptedAccessToken) {
      return {
        success: false,
        error: {
          code: PUBLISH_STATUS_SYNC_ERROR_CODES.statusSyncFailed,
          message: "渠道账号缺少访问令牌",
        },
      };
    }

    const accessToken = decryptChannelToken(
      encryptedAccessToken,
      requireChannelTokenSecret(options.env)
    );
    const adapter = getChannelAdapter(publish.platform, {
      env: options.env,
      config,
      accessToken,
      fetchImpl: options.fetchImpl,
    });

    return syncPublishStatus(input, { adapter });
  } catch {
    return {
      success: false,
      error: {
        code: PUBLISH_STATUS_SYNC_ERROR_CODES.statusSyncFailed,
        message: "发布状态同步失败",
      },
    };
  }
}
