import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const CHANNEL_TOKEN_PREFIX = "voflow_channel_token_v1";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

export const CHANNEL_TOKEN_ERROR_CODES = {
  missingSecret: "CHANNEL_TOKEN_SECRET_MISSING",
  invalidPayload: "CHANNEL_TOKEN_INVALID_PAYLOAD",
} as const;

export type ChannelTokenErrorCode =
  (typeof CHANNEL_TOKEN_ERROR_CODES)[keyof typeof CHANNEL_TOKEN_ERROR_CODES];

export interface ChannelTokenEnv {
  [key: string]: string | undefined;
  CHANNEL_TOKEN_ENCRYPTION_SECRET?: string;
}

export class ChannelTokenError extends Error {
  constructor(
    public readonly code: ChannelTokenErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ChannelTokenError";
  }
}

export function encryptChannelToken(token: string, secret: string): string {
  const key = deriveEncryptionKey(secret);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    CHANNEL_TOKEN_PREFIX,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptChannelToken(encryptedToken: string, secret: string): string {
  if (!isEncryptedChannelToken(encryptedToken)) {
    throw new ChannelTokenError(
      CHANNEL_TOKEN_ERROR_CODES.invalidPayload,
      "渠道 token 格式无效"
    );
  }

  const [, encodedIv, encodedAuthTag, encodedCiphertext] = encryptedToken.split(".");
  if (!encodedIv || !encodedAuthTag || !encodedCiphertext) {
    throw new ChannelTokenError(
      CHANNEL_TOKEN_ERROR_CODES.invalidPayload,
      "渠道 token 格式无效"
    );
  }

  const key = deriveEncryptionKey(secret);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(encodedIv, "base64url"),
    {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    }
  );
  decipher.setAuthTag(Buffer.from(encodedAuthTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function isEncryptedChannelToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith(`${CHANNEL_TOKEN_PREFIX}.`) &&
    value.split(".").length === 4
  );
}

export function requireChannelTokenSecret(
  env: ChannelTokenEnv = process.env
): string {
  const secret = env.CHANNEL_TOKEN_ENCRYPTION_SECRET?.trim();
  if (!secret) {
    throw new ChannelTokenError(
      CHANNEL_TOKEN_ERROR_CODES.missingSecret,
      "缺少渠道 token 加密密钥"
    );
  }

  return secret;
}

function deriveEncryptionKey(secret: string): Buffer {
  if (!secret.trim()) {
    throw new ChannelTokenError(
      CHANNEL_TOKEN_ERROR_CODES.missingSecret,
      "缺少渠道 token 加密密钥"
    );
  }

  return createHash("sha256").update(secret).digest();
}
