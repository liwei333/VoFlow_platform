import { spawn as nodeSpawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import type { Readable } from "node:stream";
import {
  REFERENCE_URL_IMPORT_ERROR_CODES,
  REFERENCE_URL_IMPORT_ERROR_MESSAGES,
} from "@/lib/references/url-import/config";

type SpawnedProcess = {
  stdout?: Readable | null;
  stderr?: Readable | null;
  kill: () => boolean;
  on(event: "error", listener: (error: Error) => void): unknown;
  on(event: "close", listener: (code: number | null) => void): unknown;
};

export type YtDlpSpawn = (
  command: string,
  args: string[],
  options: { shell: false }
) => SpawnedProcess;

export class YtDlpClientError extends Error {
  constructor(
    public readonly code:
      | typeof REFERENCE_URL_IMPORT_ERROR_CODES.ytdlpUnavailable
      | typeof REFERENCE_URL_IMPORT_ERROR_CODES.ytdlpTimeout
      | typeof REFERENCE_URL_IMPORT_ERROR_CODES.metadataInvalid
      | typeof REFERENCE_URL_IMPORT_ERROR_CODES.audioSizeLimitExceeded
      | typeof REFERENCE_URL_IMPORT_ERROR_CODES.audioExtractFailed,
    message: string,
    public readonly detail?: string
  ) {
    super(message);
    this.name = "YtDlpClientError";
  }
}

export interface YtDlpClientOptions {
  ytdlpBin: string;
  timeoutMs: number;
  maxMetadataBytes: number;
  spawn?: YtDlpSpawn;
}

export interface YtDlpExtractedAudio {
  content: Buffer;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export class YtDlpClient {
  private readonly spawn: YtDlpSpawn;

  constructor(private readonly options: YtDlpClientOptions) {
    this.spawn = options.spawn ?? nodeSpawn;
  }

  async getMetadata(sourceUrl: string): Promise<Record<string, unknown>> {
    const output = await this.run(["--dump-single-json", "--no-warnings", sourceUrl], {
      maxStdoutBytes: this.options.maxMetadataBytes,
    });

    try {
      const parsed = JSON.parse(output.stdout) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("yt-dlp metadata must be a JSON object");
      }

      return parsed as Record<string, unknown>;
    } catch (error) {
      throw new YtDlpClientError(
        REFERENCE_URL_IMPORT_ERROR_CODES.metadataInvalid,
        REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.metadataInvalid],
        getErrorDetail(error)
      );
    }
  }

  async extractAudio(
    sourceUrl: string,
    options: { maxAudioBytes: number }
  ): Promise<YtDlpExtractedAudio> {
    const outputDirectory = await mkdtemp(join(tmpdir(), "voflow-reference-audio-"));

    try {
      await this.run(
        [
          "--no-playlist",
          "--no-warnings",
          "--extract-audio",
          "--audio-format",
          "m4a",
          "--audio-quality",
          "0",
          "--max-filesize",
          `${options.maxAudioBytes}`,
          "--output",
          join(outputDirectory, "reference-audio.%(ext)s"),
          sourceUrl,
        ],
        { maxStdoutBytes: 64 * 1024 }
      );

      const files = await readdir(outputDirectory);
      const audioFile = files.find((file) => isSupportedExtractedAudio(file));
      if (!audioFile) {
        throw new YtDlpClientError(
          REFERENCE_URL_IMPORT_ERROR_CODES.audioExtractFailed,
          REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.audioExtractFailed],
          "yt-dlp did not create an audio output file"
        );
      }

      const audioPath = join(outputDirectory, audioFile);
      const audioStat = await stat(audioPath);
      if (audioStat.size > options.maxAudioBytes) {
        throw new YtDlpClientError(
          REFERENCE_URL_IMPORT_ERROR_CODES.audioSizeLimitExceeded,
          REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.audioSizeLimitExceeded],
          `extracted audio size ${audioStat.size} exceeds ${options.maxAudioBytes}`
        );
      }

      return {
        content: await readFile(audioPath),
        fileName: basename(audioFile),
        mimeType: getAudioMimeType(audioFile),
        sizeBytes: audioStat.size,
      };
    } catch (error) {
      if (error instanceof YtDlpClientError) {
        throw error;
      }

      throw new YtDlpClientError(
        REFERENCE_URL_IMPORT_ERROR_CODES.audioExtractFailed,
        REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.audioExtractFailed],
        getErrorDetail(error)
      );
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  }

  private run(
    args: string[],
    options: {
      maxStdoutBytes: number;
    }
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = this.spawn(this.options.ytdlpBin, args, { shell: false });
      let stdout = "";
      let stderr = "";
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill();
        reject(
          new YtDlpClientError(
            REFERENCE_URL_IMPORT_ERROR_CODES.ytdlpTimeout,
            REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.ytdlpTimeout]
          )
        );
      }, this.options.timeoutMs);

      child.stdout?.on("data", (chunk: Buffer | string) => {
        stdout += chunk.toString();
        if (stdout.length > options.maxStdoutBytes && !settled) {
          settled = true;
          clearTimeout(timeout);
          child.kill();
          reject(
            new YtDlpClientError(
              REFERENCE_URL_IMPORT_ERROR_CODES.metadataInvalid,
              REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.metadataInvalid],
              "yt-dlp metadata exceeded configured size limit"
            )
          );
        }
      });

      child.stderr?.on("data", (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      child.on("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(
          new YtDlpClientError(
            REFERENCE_URL_IMPORT_ERROR_CODES.ytdlpUnavailable,
            REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.ytdlpUnavailable],
            error.message
          )
        );
      });

      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);

        if (code !== 0) {
          reject(
            new YtDlpClientError(
              REFERENCE_URL_IMPORT_ERROR_CODES.metadataInvalid,
              REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.metadataInvalid],
              stderr.trim() || `yt-dlp exited with code ${code}`
            )
          );
          return;
        }

        resolve({ stdout, stderr });
      });
    });
  }
}

function getErrorDetail(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Unknown yt-dlp error";
}

function isSupportedExtractedAudio(fileName: string): boolean {
  return [".m4a", ".mp3", ".wav", ".aac", ".opus", ".webm"].includes(
    extname(fileName).toLowerCase()
  );
}

function getAudioMimeType(fileName: string): string {
  const extension = extname(fileName).toLowerCase();
  if (extension === ".mp3") return "audio/mpeg";
  if (extension === ".wav") return "audio/wav";
  if (extension === ".aac") return "audio/aac";
  if (extension === ".opus") return "audio/opus";
  if (extension === ".webm") return "audio/webm";
  return "audio/mp4";
}
