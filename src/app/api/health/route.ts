import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { redis } from "@/lib/auth";
import { buildLocalModelServiceConfigs } from "@/lib/local-model/config";
import { checkLocalModelServices } from "@/lib/local-model/health";

interface DependencyStatus {
  status: "up" | "down";
  latency?: number;
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

export async function GET() {
  const [postgres, redisStatus, minio] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkMinIO(),
  ]);

  const modelServiceConfigs = buildLocalModelServiceConfigs();
  const modelHealthResults = await checkLocalModelServices(modelServiceConfigs);
  const models = Object.fromEntries(
    modelServiceConfigs.map((service) => {
      const health = modelHealthResults.find((result) => result.type === service.type);
      return [
        service.type,
        {
          configured: service.status !== "misconfigured",
          status: health?.status ?? service.status,
          url: service.baseUrl,
          modelName: service.modelName,
          latency: health?.latencyMs,
          error: health?.errorMessage ?? service.lastError?.errorMessage,
        },
      ];
    })
  );

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
    models,
  };

  return NextResponse.json(response, {
    status: allUp ? 200 : 503,
  });
}
