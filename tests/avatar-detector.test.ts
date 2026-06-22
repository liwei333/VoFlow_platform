import { describe, expect, it } from "vitest";
import {
  buildAvatarPhotoDetector,
  createLocalAvatarPhotoDetector,
  detectAvatarPhotoContent,
  mockAvatarPhotoDetector,
  unavailableAvatarPhotoDetector,
} from "@/lib/avatar/detector";
import type { AvatarPhotoMetadata } from "@/lib/avatar/photo";

const metadata: AvatarPhotoMetadata = {
  mimeType: "image/png",
  sizeBytes: 5_000,
  width: 1080,
  height: 1440,
  shortSide: 1080,
  minShortSide: 720,
  resolutionPassed: true,
};

describe("avatar photo detector", () => {
  it("uses an explicit unavailable detector by default", async () => {
    await expect(
      detectAvatarPhotoContent({
        buffer: Buffer.from("png"),
        fileName: "avatar.png",
        metadata,
      })
    ).resolves.toBeUndefined();
  });

  it("can consume a concrete detector implementation", async () => {
    const detection = await detectAvatarPhotoContent(
      {
        buffer: Buffer.from("png"),
        fileName: "avatar.png",
        metadata,
      },
      {
        async detect() {
          return {
            faceCount: 1,
            faceBoxRatio: 0.5,
            confidence: 0.99,
            yaw: 1,
            pitch: 2,
            roll: 3,
            blurScore: 180,
            occlusion: "none",
            exposure: "normal",
          };
        },
      }
    );

    expect(detection).toEqual({
      faceCount: 1,
      faceBoxRatio: 0.5,
      confidence: 0.99,
      yaw: 1,
      pitch: 2,
      roll: 3,
      blurScore: 180,
      occlusion: "none",
      exposure: "normal",
    });
  });

  it("exports the unavailable detector for route wiring", async () => {
    await expect(
      unavailableAvatarPhotoDetector.detect({
        buffer: Buffer.from("png"),
        fileName: "avatar.png",
        metadata,
      })
    ).resolves.toBeUndefined();
  });

  it("selects the unavailable detector when no provider is configured", async () => {
    const detector = buildAvatarPhotoDetector({});

    await expect(
      detector.detect({
        buffer: Buffer.from("png"),
        fileName: "avatar.png",
        metadata,
      })
    ).resolves.toBeUndefined();
  });

  it("selects the mock detector from configuration", async () => {
    const detector = buildAvatarPhotoDetector({
      AVATAR_PHOTO_DETECTOR_PROVIDER: "mock",
    });

    await expect(
      detector.detect({
        buffer: Buffer.from("png"),
        fileName: "avatar.png",
        metadata,
      })
    ).resolves.toMatchObject({
      faceCount: 1,
      yaw: 0,
      pitch: 0,
      roll: 0,
      blurScore: 160,
      occlusion: "none",
      exposure: "normal",
    });
  });

  it("keeps local detector unavailable when avatar service is not online", async () => {
    const logger = { warn: vi.fn() };
    const fetcher = vi.fn();
    const detector = createLocalAvatarPhotoDetector({
      findService: async () => ({
        baseUrl: "http://localhost:7000",
        status: "offline",
      }),
      fetcher,
      logger,
    });

    await expect(
      detector.detect({
        buffer: Buffer.from("png"),
        fileName: "avatar.png",
        metadata,
      })
    ).resolves.toBeUndefined();

    expect(fetcher).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "Local avatar photo detector unavailable",
      expect.objectContaining({ status: "offline" })
    );
  });

  it("selects local detector from configuration", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        faceCount: 1,
        yaw: 1,
        pitch: 2,
        roll: 3,
        blurScore: 180,
        occlusion: "none",
        exposure: "normal",
      }),
    });
    const detector = buildAvatarPhotoDetector({
      AVATAR_PHOTO_DETECTOR_PROVIDER: "local",
    }, {
      findLocalAvatarService: async () => ({
        baseUrl: "http://localhost:7000/",
        status: "online",
      }),
      fetcher,
    });

    await expect(
      detector.detect({
        buffer: Buffer.from("png"),
        fileName: "avatar.png",
        metadata,
      })
    ).resolves.toMatchObject({
      faceCount: 1,
      yaw: 1,
      pitch: 2,
      roll: 3,
      blurScore: 180,
      occlusion: "none",
      exposure: "normal",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:7000/detect-face",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: expect.any(AbortSignal),
        body: expect.any(String),
      })
    );
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
      fileName: "avatar.png",
      mimeType: "image/png",
      imageBase64: Buffer.from("png").toString("base64"),
      metadata: {
        width: 1080,
        height: 1440,
      },
    });
  });

  it("uses the configured timeout when calling the local detector service", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        faceCount: 1,
        yaw: 1,
        pitch: 2,
        roll: 3,
        blurScore: 180,
        occlusion: "none",
        exposure: "normal",
      }),
    });
    const detector = buildAvatarPhotoDetector(
      {
        AVATAR_PHOTO_DETECTOR_PROVIDER: "local",
        AVATAR_PHOTO_DETECTOR_TIMEOUT_MS: "1234",
      },
      {
        findLocalAvatarService: async () => ({
          baseUrl: "http://localhost:7000",
          status: "online",
        }),
        fetcher,
      }
    );

    await detector.detect({
      buffer: Buffer.from("png"),
      fileName: "avatar.png",
      metadata,
    });

    expect(fetcher.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("returns undefined and logs when local detector request times out", async () => {
    vi.useFakeTimers();
    const logger = { warn: vi.fn() };
    const detector = createLocalAvatarPhotoDetector({
      findService: async () => ({
        baseUrl: "http://localhost:7000",
        status: "online",
      }),
      fetcher: vi.fn((_url, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("The operation was aborted")));
      })),
      logger,
      timeoutMs: 10,
    });

    try {
      const detectionPromise = detector.detect({
        buffer: Buffer.from("png"),
        fileName: "avatar.png",
        metadata,
      });
      await vi.advanceTimersByTimeAsync(10);

      await expect(detectionPromise).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        "Local avatar photo detector request failed",
        expect.objectContaining({ error: "The operation was aborted" })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns undefined when local detector response misses required contract fields", async () => {
    const logger = { warn: vi.fn() };
    const detector = createLocalAvatarPhotoDetector({
      findService: async () => ({
        baseUrl: "http://localhost:7000",
        status: "online",
      }),
      fetcher: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          faceCount: 1,
          yaw: 1,
          pitch: 2,
          roll: 3,
          blurScore: 180,
          exposure: "normal",
        }),
      }),
      logger,
    });

    await expect(
      detector.detect({
        buffer: Buffer.from("png"),
        fileName: "avatar.png",
        metadata,
      })
    ).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(
      "Local avatar photo detector response invalid",
      expect.objectContaining({
        payload: expect.objectContaining({ faceCount: 1 }),
      })
    );
  });

  it("returns undefined and logs when local detector request fails", async () => {
    const logger = { warn: vi.fn() };
    const detector = createLocalAvatarPhotoDetector({
      findService: async () => ({
        baseUrl: "http://localhost:7000",
        status: "online",
      }),
      fetcher: vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      }),
      logger,
    });

    await expect(
      detector.detect({
        buffer: Buffer.from("png"),
        fileName: "avatar.png",
        metadata,
      })
    ).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(
      "Local avatar photo detector request failed",
      expect.objectContaining({ status: 503 })
    );
  });

  it("returns undefined and logs when local detector response is invalid", async () => {
    const logger = { warn: vi.fn() };
    const detector = createLocalAvatarPhotoDetector({
      findService: async () => ({
        baseUrl: "http://localhost:7000",
        status: "online",
      }),
      fetcher: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          faceCount: "one",
        }),
      }),
      logger,
    });

    await expect(
      detector.detect({
        buffer: Buffer.from("png"),
        fileName: "avatar.png",
        metadata,
      })
    ).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(
      "Local avatar photo detector response invalid",
      expect.objectContaining({ payload: { faceCount: "one" } })
    );
  });

  it("mock detector supports filename scenarios for local demos", async () => {
    const scenarios = [
      {
        fileName: "demo-multiple-faces.png",
        expected: { faceCount: 2 },
      },
      {
        fileName: "demo-blurry.png",
        expected: { blurScore: 50 },
      },
      {
        fileName: "demo-occluded.png",
        expected: { occlusion: "mask" },
      },
      {
        fileName: "demo-overexposed.png",
        expected: { exposure: "overexposed" },
      },
    ];

    for (const scenario of scenarios) {
      await expect(
        mockAvatarPhotoDetector.detect({
          buffer: Buffer.from("png"),
          fileName: scenario.fileName,
          metadata,
        })
      ).resolves.toMatchObject(scenario.expected);
    }
  });

  it("detects with the provider configured in process env", async () => {
    const previousProvider = process.env.AVATAR_PHOTO_DETECTOR_PROVIDER;
    process.env.AVATAR_PHOTO_DETECTOR_PROVIDER = "mock";

    try {
      await expect(
        detectAvatarPhotoContent({
          buffer: Buffer.from("png"),
          fileName: "avatar.png",
          metadata,
        })
      ).resolves.toMatchObject({
        faceCount: 1,
        blurScore: 160,
        occlusion: "none",
        exposure: "normal",
      });
    } finally {
      if (previousProvider === undefined) {
        delete process.env.AVATAR_PHOTO_DETECTOR_PROVIDER;
      } else {
        process.env.AVATAR_PHOTO_DETECTOR_PROVIDER = previousProvider;
      }
    }
  });
});
