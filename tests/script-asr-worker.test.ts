import { describe, expect, it } from "vitest";
import type { WorkflowQueuePayload } from "@/lib/queue/adapter";
import {
  LOCAL_ASR_UNAVAILABLE,
  createAsrWorkflowNodeHandler,
} from "@/services/scriptAsrWorkerService";

const payload: WorkflowQueuePayload = {
  jobId: "job-1",
  nodeId: "node-1",
  nodeType: "script_prepare",
  version: 1,
  traceId: "trace-1",
};

describe("ASR workflow node handler", () => {
  it("downloads media, reads ASR registry config, and returns transcript with segments", async () => {
    const calls: unknown[] = [];
    const handler = createAsrWorkflowNodeHandler({
      storage: {
        downloadObject: async (storageUrl) => {
          calls.push({ downloadObject: storageUrl });
          return Buffer.from("media-bytes");
        },
      },
      registry: {
        getAsrService: async () => ({
          serviceType: "asr",
          name: "ASR 转写",
          baseUrl: "http://localhost:6000",
          status: "online",
        }),
      },
      provider: {
        transcribe: async (input) => {
          calls.push({
            transcribe: {
              baseUrl: input.service.baseUrl,
              media: input.media.toString(),
              assetId: input.assetId,
              traceId: input.traceId,
            },
          });
          return {
            text: "欢迎来到 VoFlow",
            segments: [
              { startMs: 0, endMs: 1200, text: "欢迎来到" },
              { startMs: 1200, endMs: 2200, text: "VoFlow" },
            ],
            provider: "mock-asr",
          };
        },
      },
      resultWriter: {
        saveTranscription: async (input) => {
          calls.push({ saveTranscription: input });
          return { id: "script-1" };
        },
      },
    });

    await expect(
      handler({
        payload,
        input: {
          sourceType: "media_asr",
          assetId: "asset-1",
          assetType: "audio",
          storageUrl: "voflow/team/assets/sample.wav",
          durationMs: 2200,
        },
      })
    ).resolves.toEqual({
      output: {
        sourceType: "media_asr",
        assetId: "asset-1",
        assetType: "audio",
        durationMs: 2200,
        text: "欢迎来到 VoFlow",
        segments: [
          { startMs: 0, endMs: 1200, text: "欢迎来到" },
          { startMs: 1200, endMs: 2200, text: "VoFlow" },
        ],
        provider: "mock-asr",
        scriptId: "script-1",
      },
    });

    expect(calls).toEqual([
      { downloadObject: "voflow/team/assets/sample.wav" },
      {
        transcribe: {
          baseUrl: "http://localhost:6000",
          media: "media-bytes",
          assetId: "asset-1",
          traceId: "trace-1",
        },
      },
      {
        saveTranscription: {
          jobId: "job-1",
          assetId: "asset-1",
          assetType: "audio",
          durationMs: 2200,
          text: "欢迎来到 VoFlow",
          segments: [
            { startMs: 0, endMs: 1200, text: "欢迎来到" },
            { startMs: 1200, endMs: 2200, text: "VoFlow" },
          ],
          provider: "mock-asr",
        },
      },
    ]);
  });

  it("fails when ASR service is unavailable in the local model registry", async () => {
    const handler = createAsrWorkflowNodeHandler({
      storage: {
        downloadObject: async () => Buffer.from("media-bytes"),
      },
      registry: {
        getAsrService: async () => ({
          serviceType: "asr",
          name: "ASR 转写",
          baseUrl: "http://localhost:6000",
          status: "offline",
        }),
      },
      provider: {
        transcribe: async () => {
          throw new Error("provider should not be called");
        },
      },
    });

    await expect(
      handler({
        payload,
        input: {
          sourceType: "media_asr",
          assetId: "asset-1",
          assetType: "audio",
          storageUrl: "voflow/team/assets/sample.wav",
          durationMs: 2200,
        },
      })
    ).rejects.toMatchObject({
      code: LOCAL_ASR_UNAVAILABLE,
      message: "ASR 服务不可用",
    });
  });
});
