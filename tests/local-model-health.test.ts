import { describe, expect, it, vi } from "vitest";
import {
  checkLocalModelService,
  checkLocalModelServices,
} from "@/lib/local-model/health";

describe("Local model health adapter", () => {
  it("returns misconfigured without calling external service when base URL is missing", async () => {
    const fetcher = vi.fn();

    await expect(
      checkLocalModelService(
        { type: "tts", name: "TTS", status: "misconfigured" },
        { fetcher }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        type: "tts",
        status: "misconfigured",
        errorCode: "LOCAL_SERVICE_MISCONFIGURED",
      })
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("checks HTTP service health endpoints and returns latency", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    await expect(
      checkLocalModelService(
        {
          type: "asr",
          name: "ASR",
          baseUrl: "http://localhost:6000",
          status: "offline",
        },
        { fetcher, now: () => 1000, monotonicNow: vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(42) }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        type: "asr",
        status: "online",
        latencyMs: 32,
        checkedAt: new Date(1000),
      })
    );
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:6000/health",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("checks LLM model endpoint and reports model-not-loaded errors", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: "other-model" }] }),
    });

    await expect(
      checkLocalModelService(
        {
          type: "llm",
          name: "LLM",
          baseUrl: "http://localhost:8000",
          modelName: "qwen2.5",
          status: "offline",
        },
        { fetcher }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        type: "llm",
        status: "offline",
        errorCode: "LOCAL_MODEL_NOT_LOADED",
      })
    );
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8000/v1/models",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("records timeout errors when a service check is aborted", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    const fetcher = vi.fn().mockRejectedValue(abortError);

    await expect(
      checkLocalModelService(
        {
          type: "tts",
          name: "TTS",
          baseUrl: "http://localhost:5000",
          status: "offline",
        },
        { fetcher, now: () => 1000, monotonicNow: vi.fn().mockReturnValueOnce(1).mockReturnValueOnce(3001) }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        type: "tts",
        status: "offline",
        latencyMs: 3000,
        checkedAt: new Date(1000),
        errorCode: "LOCAL_SERVICE_TIMEOUT",
      })
    );
  });

  it("checks FFmpeg by running the configured worker command", async () => {
    const commandRunner = vi.fn().mockResolvedValue({ stdout: "ffmpeg version 7.1" });

    await expect(
      checkLocalModelService(
        {
          type: "ffmpeg",
          name: "FFmpeg",
          baseUrl: "/usr/local/bin/ffmpeg",
          status: "offline",
        },
        { commandRunner, now: () => 1000, monotonicNow: vi.fn().mockReturnValueOnce(5).mockReturnValueOnce(17) }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        type: "ffmpeg",
        status: "online",
        latencyMs: 12,
      })
    );
    expect(commandRunner).toHaveBeenCalledWith("/usr/local/bin/ffmpeg", ["-version"], expect.any(Object));
  });

  it("checks all services even when one fails", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: [{ id: "qwen" }] }) })
      .mockRejectedValueOnce(new Error("connection refused"));

    await expect(
      checkLocalModelServices(
        [
          { type: "llm", name: "LLM", baseUrl: "http://localhost:8000", modelName: "qwen", status: "offline" },
          { type: "tts", name: "TTS", baseUrl: "http://localhost:5000", status: "offline" },
        ],
        { fetcher }
      )
    ).resolves.toEqual([
      expect.objectContaining({ type: "llm", status: "online" }),
      expect.objectContaining({ type: "tts", status: "offline", errorCode: "LOCAL_SERVICE_OFFLINE" }),
    ]);
  });
});
