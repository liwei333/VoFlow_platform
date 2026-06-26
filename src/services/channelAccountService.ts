import type { ChannelAccountStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  serializeChannelAccount,
  type ChannelAccountRecord,
  type SerializedChannelAccount,
} from "@/lib/publish/channel-account";
import { PUBLISH_PLATFORMS, type PublishPlatform } from "@/lib/publish/rules";
import {
  CHANNEL_TOKEN_ERROR_CODES,
  encryptChannelToken,
  requireChannelTokenSecret,
  type ChannelTokenEnv,
} from "@/lib/publish/token";

export type SaveChannelAccountTokenErrorCode =
  typeof CHANNEL_TOKEN_ERROR_CODES.missingSecret;

export interface GetChannelAccountsInput {
  teamId: string;
  userId: string;
  now?: Date;
}

export interface SaveChannelAccountTokenInput {
  teamId: string;
  userId: string;
  platform: PublishPlatform;
  accountName?: string | null;
  token: string;
  expiresAt?: Date | null;
  status?: Extract<ChannelAccountStatus, "connected" | "expired" | "not_connected">;
}

export interface SaveChannelAccountTokenOptions {
  tokenSecret?: string;
  env?: ChannelTokenEnv;
}

export type GetChannelAccountsResult = {
  success: true;
  data: {
    accounts: SerializedChannelAccount[];
  };
};

export type SaveChannelAccountTokenResult =
  | {
      success: true;
      data: {
        account: SerializedChannelAccount;
      };
    }
  | {
      success: false;
      error: {
        code: SaveChannelAccountTokenErrorCode;
        message: string;
      };
    };

const CHANNEL_ACCOUNT_SELECT = {
  id: true,
  platform: true,
  accountName: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ChannelAccountSelect;

export async function getChannelAccountsForUser(
  input: GetChannelAccountsInput
): Promise<GetChannelAccountsResult> {
  const accounts = await prisma.channelAccount.findMany({
    where: {
      teamId: input.teamId,
      userId: input.userId,
    },
    select: CHANNEL_ACCOUNT_SELECT,
  });
  const accountByPlatform = new Map<PublishPlatform, ChannelAccountRecord>();

  for (const account of accounts) {
    accountByPlatform.set(account.platform, account as ChannelAccountRecord);
  }

  return {
    success: true,
    data: {
      accounts: PUBLISH_PLATFORMS.map((platform) =>
        serializeChannelAccount(
          platform,
          accountByPlatform.get(platform) ?? null,
          input.now
        )
      ),
    },
  };
}

export async function saveChannelAccountToken(
  input: SaveChannelAccountTokenInput,
  options: SaveChannelAccountTokenOptions = {}
): Promise<SaveChannelAccountTokenResult> {
  let tokenSecret: string;
  try {
    tokenSecret = options.tokenSecret ?? requireChannelTokenSecret(options.env);
  } catch (error) {
    return {
      success: false,
      error: {
        code: CHANNEL_TOKEN_ERROR_CODES.missingSecret,
        message: error instanceof Error ? error.message : "缺少渠道 token 加密密钥",
      },
    };
  }

  const encryptedToken = encryptChannelToken(input.token, tokenSecret);
  const status = input.status ?? resolveStoredStatus(input.expiresAt ?? null);
  const saved = await prisma.channelAccount.upsert({
    where: {
      teamId_userId_platform: {
        teamId: input.teamId,
        userId: input.userId,
        platform: input.platform,
      },
    },
    create: {
      teamId: input.teamId,
      userId: input.userId,
      platform: input.platform,
      accountName: input.accountName ?? null,
      encryptedToken,
      expiresAt: input.expiresAt ?? null,
      status,
    },
    update: {
      accountName: input.accountName ?? null,
      encryptedToken,
      expiresAt: input.expiresAt ?? null,
      status,
    },
    select: CHANNEL_ACCOUNT_SELECT,
  });

  return {
    success: true,
    data: {
      account: serializeChannelAccount(input.platform, saved as ChannelAccountRecord),
    },
  };
}

function resolveStoredStatus(expiresAt: Date | null): Extract<
  ChannelAccountStatus,
  "connected" | "expired"
> {
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    return "expired";
  }

  return "connected";
}
