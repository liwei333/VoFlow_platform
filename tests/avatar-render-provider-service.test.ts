import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AVATAR_RENDER_CROPS,
  AVATAR_RENDER_DEFAULT_RESOLUTIONS,
  AVATAR_RENDER_ERROR_CODES,
  AVATAR_RENDER_LOCAL_RENDER_PATH,
  AVATAR_RENDER_MODES,
  AVATAR_RENDER_MOCK_PROVIDER,
} from "@/lib/avatar-render/constants";
import {
  AvatarRenderProviderError,
  createLocalAvatarRenderProvider,
  createMockAvatarRenderProvider,
} from "@/services/avatarRenderProviderService";

const renderPayload = {
  requestId: "render-request-1",
  jobId: "job-1",
  nodeId: "node-1",
  avatarId: "avatar-1",
  sourceImageUrl: "s3://voflow/team/assets/avatar/source.png",
  audioUrl: "s3://voflow/team/jobs/job-1/tts/audio.wav",
  mode: "preview" as const,
  aspectRatio: "9:16" as const,
  renderOptions: {
    crop: "half_body" as const,
    resolution: "720p",
  },
  traceId: "trace-avatar-render",
};

let outputDir: string | undefined;

describe("Avatar render provider service", () => {
  afterEach(async () => {
    if (outputDir) {
      await rm(outputDir, { recursive: true, force: true });
      outputDir = undefined;
    }
  });

  it("exports render modes, crop options, and default resolutions from a shared module", () => {
    expect(AVATAR_RENDER_MODES).toEqual(["preview", "hd"]);
    expect(AVATAR_RENDER_CROPS).toEqual(["head", "half_body"]);
    expect(AVATAR_RENDER_DEFAULT_RESOLUTIONS).toEqual({
      preview: "720p",
      hd: "1080p",
    });
  });

  it("generates a playable mock mp4 file with render metadata", async () => {
    outputDir = await mkdtemp(path.join(tmpdir(), "voflow-avatar-render-"));
    const provider = createMockAvatarRenderProvider({ outputDir });

    const result = await provider.renderAvatarVideo(renderPayload);

    expect(result).toMatchObject({
      provider: AVATAR_RENDER_MOCK_PROVIDER,
      providerRequestId: "mock-trace-avatar-render",
      videoPath: expect.stringMatching(/render-request-1-preview\.mp4$/),
      durationMs: expect.any(Number),
      resolution: "720p",
      model: "mock-avatar-render",
      metadata: {
        mocked: true,
        mode: "preview",
        crop: "half_body",
        aspectRatio: "9:16",
      },
    });

    await expect(stat(result.videoPath)).resolves.toMatchObject({
      size: expect.any(Number),
    });
    const file = await readFile(result.videoPath);
    expect(file.subarray(4, 8).toString("ascii")).toBe("ftyp");
    expect(file.includes(Buffer.from("moov"))).toBe(true);
    expect(file.includes(Buffer.from("mdat"))).toBe(true);
  });

  it("posts normalized payload to the configured local avatar service without reading env URLs", async () => {
    const transport = vi.fn(async () =>
      new Response(
        JSON.stringify({
          video_path: "/tmp/avatar-render/output.mp4",
          duration_ms: 1200,
          resolution: "720p",
          model: "musetalk",
          provider_request_id: "provider-request-1",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );
    const provider = createLocalAvatarRenderProvider(
      {
        baseUrl: "http://localhost:7012/",
        status: "online",
        modelName: "musetalk",
      },
      transport
    );

    const result = await provider.renderAvatarVideo(renderPayload);

    expect(transport).toHaveBeenCalledWith(
      `http://localhost:7012${AVATAR_RENDER_LOCAL_RENDER_PATH}`,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(JSON.parse(transport.mock.calls[0][1].body as string)).toMatchObject({
      requestId: "render-request-1",
      jobId: "job-1",
      nodeId: "node-1",
      avatarId: "avatar-1",
      sourceImageUrl: "s3://voflow/team/assets/avatar/source.png",
      audioUrl: "s3://voflow/team/jobs/job-1/tts/audio.wav",
      mode: "preview",
      aspectRatio: "9:16",
      renderOptions: {
        crop: "half_body",
        resolution: "720p",
      },
      traceId: "trace-avatar-render",
      modelName: "musetalk",
    });
    expect(result).toMatchObject({
      provider: "local",
      providerRequestId: "provider-request-1",
      videoPath: "/tmp/avatar-render/output.mp4",
      durationMs: 1200,
      resolution: "720p",
      model: "musetalk",
    });
  });

  it("throws a provider error when the local avatar service is unavailable", async () => {
    const provider = createLocalAvatarRenderProvider({
      baseUrl: null,
      status: "misconfigured",
      modelName: "musetalk",
    });

    await expect(provider.renderAvatarVideo(renderPayload)).rejects.toMatchObject({
      code: "AVATAR_PROVIDER_UNAVAILABLE",
    } satisfies Partial<AvatarRenderProviderError>);
  });

  it("maps local avatar provider timeout responses to the timeout error code", async () => {
    const transport = vi.fn(async () => new Response("timeout", { status: 504 }));
    const provider = createLocalAvatarRenderProvider(
      {
        baseUrl: "http://localhost:7012",
        status: "online",
        modelName: "musetalk",
      },
      transport
    );

    await expect(provider.renderAvatarVideo(renderPayload)).rejects.toMatchObject({
      code: AVATAR_RENDER_ERROR_CODES.providerTimeout,
    } satisfies Partial<AvatarRenderProviderError>);
  });

  it("maps aborted local avatar provider requests to the timeout error code", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    const transport = vi.fn(async () => {
      throw abortError;
    });
    const provider = createLocalAvatarRenderProvider(
      {
        baseUrl: "http://localhost:7012",
        status: "online",
        modelName: "musetalk",
      },
      transport
    );

    await expect(provider.renderAvatarVideo(renderPayload)).rejects.toMatchObject({
      code: AVATAR_RENDER_ERROR_CODES.providerTimeout,
    } satisfies Partial<AvatarRenderProviderError>);
  });
});
