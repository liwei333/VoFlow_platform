import { spawn } from "child_process";
import path from "path";
import { prisma } from "@/lib/db";
import { buildFfprobeArgs, type FfprobeResult } from "@/lib/export/media-validation";

export async function executeConfiguredFfmpeg(args: string[]): Promise<void> {
  const ffmpegPath = await readConfiguredFfmpegPath();
  await executeFfmpegCommand(ffmpegPath, args);
}

export async function inspectMediaWithConfiguredFfprobe(
  filePath: string
): Promise<FfprobeResult> {
  const ffmpegPath = await readConfiguredFfmpegPath();
  const ffprobePath = resolveFfprobePath(ffmpegPath);
  return inspectMediaWithFfprobe(ffprobePath, filePath);
}

export async function executeFfmpegCommand(
  ffmpegPath: string,
  args: string[]
): Promise<void> {
  await runCommand(ffmpegPath, args);
}

export async function inspectMediaWithFfprobe(
  ffprobePath: string,
  filePath: string
): Promise<FfprobeResult> {
  const output = await runCommandWithOutput(ffprobePath, buildFfprobeArgs(filePath));
  return JSON.parse(output) as FfprobeResult;
}

export async function readFfmpegCommandOutput(
  command: string,
  args: string[]
): Promise<string> {
  return runCommandWithOutput(command, args);
}

async function readConfiguredFfmpegPath(): Promise<string> {
  const service = await prisma.localModelService.findUnique({
    where: {
      serviceType: "ffmpeg",
    },
    select: {
      baseUrl: true,
      status: true,
    },
  });

  if (!service?.baseUrl || service.status !== "online") {
    throw new Error("FFmpeg 服务未配置或不可用");
  }

  return service.baseUrl;
}

export function resolveFfprobePath(ffmpegPath: string): string {
  const directory = path.dirname(ffmpegPath);
  return path.join(directory, "ffprobe");
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `FFmpeg exited with code ${code}`));
    });
  });
}

function runCommandWithOutput(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(stderr.trim() || `ffprobe exited with code ${code}`));
    });
  });
}
