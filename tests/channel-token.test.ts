import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  decryptChannelToken,
  encryptChannelToken,
  isEncryptedChannelToken,
} from "@/lib/publish/token";
import { saveChannelAccountToken } from "@/services/channelAccountService";

const TEST_SECRET = "test-channel-token-secret";

describe("channel account token encryption", () => {
  const createdIds: {
    userId?: string;
    teamId?: string;
  } = {};

  afterEach(async () => {
    if (createdIds.teamId) {
      await prisma.channelAccount.deleteMany({ where: { teamId: createdIds.teamId } });
      await prisma.teamMember.deleteMany({ where: { teamId: createdIds.teamId } });
      await prisma.team.deleteMany({ where: { id: createdIds.teamId } });
    }
    if (createdIds.userId) {
      await prisma.user.deleteMany({ where: { id: createdIds.userId } });
    }
    createdIds.teamId = undefined;
    createdIds.userId = undefined;
  });

  it("encrypts tokens with a non-plaintext storage format", () => {
    const encrypted = encryptChannelToken("secret-access-token", TEST_SECRET);

    expect(encrypted).not.toContain("secret-access-token");
    expect(isEncryptedChannelToken(encrypted)).toBe(true);
    expect(decryptChannelToken(encrypted, TEST_SECRET)).toBe("secret-access-token");
  });

  it("saves channel tokens encrypted instead of storing plaintext", async () => {
    const { userId, teamId } = await createTeamFixture();
    createdIds.userId = userId;
    createdIds.teamId = teamId;

    const result = await saveChannelAccountToken(
      {
        teamId,
        userId,
        platform: "douyin",
        accountName: "抖音账号",
        token: "plain-channel-token",
        expiresAt: new Date(Date.now() + 60_000),
      },
      {
        tokenSecret: TEST_SECRET,
      }
    );

    expect(result.success).toBe(true);

    const saved = await prisma.channelAccount.findFirstOrThrow({
      where: {
        teamId,
        userId,
        platform: "douyin",
      },
    });

    expect(saved.encryptedToken).toBeTruthy();
    expect(saved.encryptedToken).not.toBe("plain-channel-token");
    expect(isEncryptedChannelToken(saved.encryptedToken)).toBe(true);
    expect(decryptChannelToken(saved.encryptedToken!, TEST_SECRET)).toBe("plain-channel-token");
    expect(saved.status).toBe("connected");
  });
});

async function createTeamFixture(): Promise<{ userId: string; teamId: string }> {
  const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const user = await prisma.user.create({
    data: {
      email: `channel_token_${unique}@example.com`,
      passwordHash: "hashed_password",
      name: "Channel Token User",
    },
  });

  const team = await prisma.team.create({
    data: {
      name: "Channel Token Team",
      ownerId: user.id,
      members: {
        create: {
          userId: user.id,
          role: "owner",
        },
      },
    },
  });

  return {
    userId: user.id,
    teamId: team.id,
  };
}
