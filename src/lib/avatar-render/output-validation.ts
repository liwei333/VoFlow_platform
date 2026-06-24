import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { promisify } from "node:util";
import {
  AVATAR_RENDER_DEFAULT_FFPROBE_BIN,
  AVATAR_RENDER_ERROR_CODES,
  AVATAR_RENDER_ERROR_MESSAGES,
  AVATAR_RENDER_FFPROBE_TIMEOUT_MS,
  AVATAR_RENDER_MIN_OUTPUT_BYTES,
  AVATAR_RENDER_VIDEO_CONTENT_TYPE,
  AVATAR_RENDER_VIDEO_EXTENSION,
  type AvatarRenderErrorCode,
} from "@/lib/avatar-render/constants";

export type AvatarRenderOutputProbeResult = {
  durationMs: number;
  videoStreamCount: number;
  codecName?: string;
};

export type AvatarRenderOutputValidationInput = {
  videoPath: string;
  expectedDurationMs: number;
  contentType?: string;
  fileExtension?: string;
};

export type AvatarRenderOutputValidationResult = {
  videoBuffer: Buffer;
  metadata: {
    sizeBytes: number;
    durationMs: number;
    expectedDurationMs: number;
    videoStreamCount: number;
    codecName?: string;
    contentType: string;
    fileExtension: string;
  };
};

export type AvatarRenderOutputStat = {
  size: number;
  isFile?: () => boolean;
};

export type AvatarRenderOutputStatReader = (videoPath: string) => Promise<AvatarRenderOutputStat>;
export type AvatarRenderOutputFileReader = (videoPath: string) => Promise<Buffer>;
export type AvatarRenderVideoProbe = (videoPath: string) => Promise<AvatarRenderOutputProbeResult>;

export interface AvatarRenderOutputValidationDependencies {
  statFile: AvatarRenderOutputStatReader;
  readFile: AvatarRenderOutputFileReader;
  probeVideo: AvatarRenderVideoProbe;
}

export type AvatarRenderCommandRunner = (
  command: string,
  args: string[],
  options?: { timeoutMs?: number }
) => Promise<{ stdout: string; stderr?: string }>;

export interface FfprobeVideoProbeOptions {
  command?: string;
  timeoutMs?: number;
  commandRunner?: AvatarRenderCommandRunner;
}

export class AvatarRenderOutputValidationError extends Error {
  constructor(
    public readonly code: AvatarRenderErrorCode,
    message = AVATAR_RENDER_ERROR_MESSAGES[code]
  ) {
    super(`${code}: ${message}`);
    this.name = "AvatarRenderOutputValidationError";
  }
}

const execFileAsync = promisify(execFile);

const defaultAvatarRenderOutputValidationDependencies: AvatarRenderOutputValidationDependencies = {
  statFile: stat,
  readFile,
  probeVideo: createFfprobeVideoProbe(),
};

export async function validateAvatarRenderOutput(
  input: AvatarRenderOutputValidationInput,
  dependencies: Partial<AvatarRenderOutputValidationDependencies> = {}
): Promise<AvatarRenderOutputValidationResult> {
  const { statFile, readFile, probeVideo } = {
    ...defaultAvatarRenderOutputValidationDependencies,
    ...dependencies,
  };

  try {
    const outputStat = await statFile(input.videoPath);
    if (outputStat.isFile && !outputStat.isFile()) {
      throw invalidOutputError();
    }
    if (outputStat.size < AVATAR_RENDER_MIN_OUTPUT_BYTES) {
      throw invalidOutputError();
    }

    const probe = await probeVideo(input.videoPath);
    if (
      !Number.isFinite(probe.durationMs) ||
      probe.durationMs <= 0 ||
      !Number.isInteger(probe.videoStreamCount) ||
      probe.videoStreamCount <= 0
    ) {
      throw invalidOutputError();
    }

    const videoBuffer = await readFile(input.videoPath);
    return {
      videoBuffer,
      metadata: {
        sizeBytes: outputStat.size,
        durationMs: Math.round(probe.durationMs),
        expectedDurationMs: Math.round(input.expectedDurationMs),
        videoStreamCount: probe.videoStreamCount,
        ...(probe.codecName ? { codecName: probe.codecName } : {}),
        contentType: input.contentType ?? AVATAR_RENDER_VIDEO_CONTENT_TYPE,
        fileExtension: input.fileExtension ?? AVATAR_RENDER_VIDEO_EXTENSION,
      },
    };
  } catch (error) {
    if (error instanceof AvatarRenderOutputValidationError) {
      throw error;
    }

    throw invalidOutputError();
  }
}

export function createFfprobeVideoProbe(
  options: FfprobeVideoProbeOptions = {}
): AvatarRenderVideoProbe {
  const command = options.command ?? process.env.FFPROBE_WORKER ?? AVATAR_RENDER_DEFAULT_FFPROBE_BIN;
  const timeoutMs = options.timeoutMs ?? AVATAR_RENDER_FFPROBE_TIMEOUT_MS;
  const commandRunner = options.commandRunner ?? runCommand;

  return async (videoPath) => {
    try {
      const result = await commandRunner(
        command,
        [
          "-v",
          "error",
          "-select_streams",
          "v:0",
          "-show_entries",
          "stream=codec_type,codec_name:format=duration",
          "-of",
          "json",
          videoPath,
        ],
        { timeoutMs }
      );
      return parseFfprobeOutput(result.stdout);
    } catch {
      throw invalidOutputError();
    }
  };
}

async function runCommand(command: string, args: string[], options?: { timeoutMs?: number }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? AVATAR_RENDER_FFPROBE_TIMEOUT_MS);

  try {
    const result = await execFileAsync(command, args, { signal: controller.signal });
    return {
      stdout: String(result.stdout),
      stderr: result.stderr === undefined ? undefined : String(result.stderr),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseFfprobeOutput(stdout: string): AvatarRenderOutputProbeResult {
  const parsed = JSON.parse(stdout) as {
    streams?: Array<{ codec_type?: unknown; codec_name?: unknown }>;
    format?: { duration?: unknown };
  };
  const videoStreams = Array.isArray(parsed.streams)
    ? parsed.streams.filter((stream) => stream.codec_type === "video")
    : [];
  const durationSeconds = Number(parsed.format?.duration);

  return {
    durationMs: Number.isFinite(durationSeconds) ? Math.round(durationSeconds * 1000) : 0,
    videoStreamCount: videoStreams.length,
    ...(typeof videoStreams[0]?.codec_name === "string"
      ? { codecName: videoStreams[0].codec_name }
      : {}),
  };
}

function invalidOutputError() {
  return new AvatarRenderOutputValidationError(AVATAR_RENDER_ERROR_CODES.invalidProviderOutput);
}
