import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { redis } from "@/lib/auth";

type ServiceStatus = "online" | "offline" | "unknown";

interface DependencyStatus {
  status: "up" | "down";
  latency?: number;
  error?: string;
}

interface ModelStatus {
  configured: boolean;
  status: ServiceStatus;
  url?: string;
  error?: string;
}

async function checkPostgres(): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "up", latency: Date.now() - start };
  } catch (error) {
    return { status: "down", error: String(error) };
  }
}

async function checkRedis(): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    await redis.ping();
    return { status: "up", latency: Date.now() - start };
  } catch (error) {
    return { status: "down", error: String(error) };
  }
}

async function checkMinIO(): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    const endpoint = process.env.MINIO_ENDPOINT || "localhost";
    const port = process.env.MINIO_PORT || "9000";
    const response = await fetch(
      `http://${endpoint}:${port}/minio/health/live`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (response.ok) {
      return { status: "up", latency: Date.now() - start };
    }
    return { status: "down", error: `HTTP ${response.status}` };
  } catch (error) {
    return { status: "down", error: String(error) };
  }
}

async function checkModelService(url: string | undefined): Promise<ModelStatus> {
  if (!url) {
    return { configured: false, status: "unknown", error: "未配置" };
  }
  try {
    const response = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      return { configured: true, status: "online", url };
    }
    return { configured: true, status: "offline", url, error: `HTTP ${response.status}` };
  } catch (error) {
    return { configured: true, status: "offline", url, error: String(error) };
  }
}

export async function GET() {
  const [postgres, redisStatus, minio] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkMinIO(),
  ]);

  // Check model services
  const [llm, tts, asr, avatar] = await Promise.all([
    checkModelService(process.env.LLM_BASE_URL),
    checkModelService(process.env.TTS_BASE_URL),
    checkModelService(process.env.ASR_BASE_URL),
    checkModelService(process.env.AVATAR_BASE_URL),
  ]);

  const allUp =
    postgres.status === "up" &&
    redisStatus.status === "up" &&
    minio.status === "up";

  const response = {
    status: allUp ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    dependencies: {
      postgres,
      redis: redisStatus,
      minio,
    },
    models: {
      llm,
      tts,
      asr,
      avatar,
    },
  };

  return NextResponse.json(response, {
    status: allUp ? 200 : 503,
  });
}
