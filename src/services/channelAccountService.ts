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

export interface SaveRealChannelAccountTokenInput {
  teamId: string;
  userId: string;
  platform: PublishPlatform;
  provider: string;
  providerAccountId: string;
  accountName?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  tokenType?: string | null;
  scopes: string[];
  metadata?: Prisma.InputJsonValue | null;
  expiresAt?: Date | null;
  authorizedAt?: Date;
  refreshedAt?: Date | null;
}

export interface UpdateRealChannelAccountTokenInput {
  accountId: string;
  accessToken: string;
  refreshToken?: string | null;
  tokenType?: string | null;
  scopes?: string[];
  expiresAt?: Date | null;
  refreshedAt: Date;
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

export type SaveRealChannelAccountTokenResult = SaveChannelAccountTokenResult;

const CHANNEL_ACCOUNT_SELECT = {
  id: true,
  platform: true,
  provider: true,
  providerAccountId: true,
  accountName: true,
  status: true,
  expiresAt: true,
  scopesJson: true,
  metadataJson: true,
  lastAuthorizedAt: true,
  lastRefreshAt: true,
  lastErrorJson: true,
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

export async function saveRealChannelAccountToken(
  input: SaveRealChannelAccountTokenInput,
  options: SaveChannelAccountTokenOptions = {}
): Promise<SaveRealChannelAccountTokenResult> {
  const tokenSecretResult = resolveTokenSecret(options);
  if (!tokenSecretResult.success) {
    return tokenSecretResult;
  }

  const encryptedAccessToken = encryptChannelToken(
    input.accessToken,
    tokenSecretResult.data
  );
  const encryptedRefreshToken = input.refreshToken
    ? encryptChannelToken(input.refreshToken, tokenSecretResult.data)
    : null;
  const authorizedAt = input.authorizedAt ?? new Date();
  const status = resolveStoredStatus(input.expiresAt ?? null, authorizedAt);
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
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      accountName: input.accountName ?? null,
      encryptedToken: encryptedAccessToken,
      encryptedAccessToken,
      encryptedRefreshToken,
      tokenType: input.tokenType ?? null,
      scopesJson: input.scopes,
      metadataJson: input.metadata ?? undefined,
      expiresAt: input.expiresAt ?? null,
      lastAuthorizedAt: authorizedAt,
      lastRefreshAt: input.refreshedAt ?? null,
      lastErrorJson: undefined,
      status,
    },
    update: {
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      accountName: input.accountName ?? null,
      encryptedToken: encryptedAccessToken,
      encryptedAccessToken,
      ...(encryptedRefreshToken ? { encryptedRefreshToken } : {}),
      tokenType: input.tokenType ?? null,
      scopesJson: input.scopes,
      metadataJson: input.metadata ?? undefined,
      expiresAt: input.expiresAt ?? null,
      lastAuthorizedAt: authorizedAt,
      lastRefreshAt: input.refreshedAt ?? null,
      lastErrorJson: undefined,
      status,
    },
    select: CHANNEL_ACCOUNT_SELECT,
  });

  return {
    success: true,
    data: {
      account: serializeChannelAccount(input.platform, saved as ChannelAccountRecord, authorizedAt),
    },
  };
}

export async function updateRealChannelAccountAccessToken(
  input: UpdateRealChannelAccountTokenInput,
  options: SaveChannelAccountTokenOptions = {}
): Promise<SaveRealChannelAccountTokenResult> {
  const tokenSecretResult = resolveTokenSecret(options);
  if (!tokenSecretResult.success) {
    return tokenSecretResult;
  }

  const account = await prisma.channelAccount.findUnique({
    where: {
      id: input.accountId,
    },
    select: {
      platform: true,
      encryptedRefreshToken: true,
    },
  });

  if (!account) {
    throw new Error("Channel account not found");
  }

  const encryptedAccessToken = encryptChannelToken(
    input.accessToken,
    tokenSecretResult.data
  );
  const encryptedRefreshToken = input.refreshToken
    ? encryptChannelToken(input.refreshToken, tokenSecretResult.data)
    : account.encryptedRefreshToken;
  const saved = await prisma.channelAccount.update({
    where: {
      id: input.accountId,
    },
    data: {
      encryptedToken: encryptedAccessToken,
      encryptedAccessToken,
      encryptedRefreshToken,
      tokenType: input.tokenType ?? undefined,
      scopesJson: input.scopes ?? undefined,
      expiresAt: input.expiresAt ?? null,
      lastRefreshAt: input.refreshedAt,
      lastErrorJson: undefined,
      status: resolveStoredStatus(input.expiresAt ?? null, input.refreshedAt),
    },
    select: CHANNEL_ACCOUNT_SELECT,
  });

  return {
    success: true,
    data: {
      account: serializeChannelAccount(
        account.platform,
        saved as ChannelAccountRecord,
        input.refreshedAt
      ),
    },
  };
}

function resolveTokenSecret(
  options: SaveChannelAccountTokenOptions
): { success: true; data: string } | Extract<SaveChannelAccountTokenResult, { success: false }> {
  try {
    return {
      success: true,
      data: options.tokenSecret ?? requireChannelTokenSecret(options.env),
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: CHANNEL_TOKEN_ERROR_CODES.missingSecret,
        message: error instanceof Error ? error.message : "缺少渠道 token 加密密钥",
      },
    };
  }
}

function resolveStoredStatus(
  expiresAt: Date | null,
  now = new Date()
): Extract<
  ChannelAccountStatus,
  "connected" | "expired"
> {
  if (expiresAt && expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }

  return "connected";
}
