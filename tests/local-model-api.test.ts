import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createServer, type Server } from "node:http";
import { LocalModelServiceType } from "@prisma/client";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GET as listServices } from "@/app/api/local-model-services/route";
import { POST as checkOneService } from "@/app/api/local-model-services/[serviceType]/health/route";
import { POST as checkAllServices } from "@/app/api/local-model-services/health-all/route";
import { syncLocalModelServicesFromEnv } from "@/services/localModelService";

describe("local model service APIs", () => {
  let userId: string;
  let teamId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `local_model_api_${Date.now()}@example.com`,
        passwordHash: "hashed_password",
        name: "Local Model API User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Local Model API Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    await prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role: "member",
      },
    });

    await prisma.localModelService.deleteMany();
    await prisma.localModelService.createMany({
      data: [
        {
          serviceType: "llm",
          name: "本地 LLM",
          baseUrl: "http://localhost:8000",
          modelName: "qwen",
          status: "offline",
          latencyMs: 120,
          resource: { gpu: "0%" },
          lastError: { errorCode: "LOCAL_SERVICE_OFFLINE", errorMessage: "连接失败" },
          checkedAt: new Date("2026-06-20T01:00:00.000Z"),
        },
        {
          serviceType: "asr",
          name: "ASR 转写",
          status: "misconfigured",
          lastError: {
            errorCode: "LOCAL_SERVICE_MISCONFIGURED",
            errorMessage: "ASR_BASE_URL 未配置",
          },
        },
      ],
    });
  });

  afterEach(async () => {
    await prisma.localModelService.deleteMany();
    await syncLocalModelServicesFromEnv(process.env);
    await prisma.teamMember.deleteMany({
      where: {
        OR: [
          { teamId },
          { userId },
        ],
      },
    });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("requires authentication when listing services", async () => {
    const response = await listServices(new NextRequest("http://localhost:3000/api/local-model-services"));

    expect(response.status).toBe(401);
  });

  it("lists local model service status for authenticated users", async () => {
    const response = await listServices(await createRequest("/api/local-model-services"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.code).toBe("SUCCESS");
    expect(body.data.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serviceType: "llm",
          name: "本地 LLM",
          baseUrl: "http://localhost:8000",
          modelName: "qwen",
          status: "offline",
          latencyMs: 120,
          resource: { gpu: "0%" },
          lastError: { errorCode: "LOCAL_SERVICE_OFFLINE", errorMessage: "连接失败" },
          checkedAt: "2026-06-20T01:00:00.000Z",
        }),
        expect.objectContaining({
          serviceType: "asr",
          status: "misconfigured",
        }),
      ])
    );
  });

  it("runs one health check and persists misconfigured status", async () => {
    const response = await checkOneService(await createRequest("/api/local-model-services/asr/health", "POST"), {
      params: Promise.resolve({ serviceType: "asr" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.code).toBe("SUCCESS");
    expect(body.data.service).toMatchObject({
      serviceType: "asr",
      status: "misconfigured",
      lastError: {
        errorCode: "LOCAL_SERVICE_MISCONFIGURED",
        errorMessage: expect.stringContaining("服务地址未配置"),
      },
    });
    expect(body.data.service.checkedAt).toBeTruthy();

    const saved = await prisma.localModelService.findUnique({ where: { serviceType: "asr" } });
    expect(saved?.status).toBe("misconfigured");
    expect(saved?.checkedAt).toBeInstanceOf(Date);
  });

  it("clears stale lastError when a health check returns online", async () => {
    const server = await startJsonServer("/v1/models", { data: [{ id: "qwen" }] });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected test server to listen on a TCP port");
    }

    await prisma.localModelService.update({
      where: { serviceType: "llm" },
      data: {
        baseUrl: `http://127.0.0.1:${address.port}`,
        status: "offline",
        lastError: { errorCode: "LOCAL_SERVICE_OFFLINE", errorMessage: "旧错误" },
      },
    });

    try {
      const response = await checkOneService(await createRequest("/api/local-model-services/llm/health", "POST"), {
        params: Promise.resolve({ serviceType: "llm" }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.service).toMatchObject({
        serviceType: "llm",
        status: "online",
        lastError: null,
      });

      const saved = await prisma.localModelService.findUnique({ where: { serviceType: "llm" } });
      expect(saved?.status).toBe("online");
      expect(saved?.lastError).toBeNull();
    } finally {
      await closeServer(server);
    }
  });

  it("returns validation error for unknown service type", async () => {
    const response = await checkOneService(await createRequest("/api/local-model-services/unknown/health", "POST"), {
      params: Promise.resolve({ serviceType: "unknown" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("runs all health checks and returns every service even when one fails", async () => {
    const response = await checkAllServices(await createRequest("/api/local-model-services/health-all", "POST"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.code).toBe("SUCCESS");
    expect(body.data.services.map((service: { serviceType: LocalModelServiceType }) => service.serviceType)).toEqual([
      "llm",
      "asr",
    ]);
    expect(body.data.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ serviceType: "llm", status: "offline" }),
        expect.objectContaining({ serviceType: "asr", status: "misconfigured" }),
      ])
    );
  });

  async function createRequest(path: string, method = "GET"): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      teamId,
      email: "local-model-api@example.com",
      name: "Local Model API User",
    });

    return new NextRequest(`http://localhost:3000${path}`, {
      method,
      headers: {
        cookie: `session=${token}`,
      },
    });
  }

  function startJsonServer(path: string, payload: unknown): Promise<Server> {
    const server = createServer((request, response) => {
      if (request.url !== path) {
        response.writeHead(404);
        response.end();
        return;
      }

      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(payload));
    });

    return new Promise((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve(server));
    });
  }

  function closeServer(server: Server): Promise<void> {
    return new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});
