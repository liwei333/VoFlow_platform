import { describe, expect, it } from "vitest";
import { getMinioDiagnostics } from "../src/lib/storage";

describe("MinIO diagnostics", () => {
  it("includes connection config and the root error message", () => {
    const diagnostics = getMinioDiagnostics(new Error("connect ECONNREFUSED 127.0.0.1:9000"));

    expect(diagnostics).toMatchObject({
      endpoint: process.env.MINIO_ENDPOINT || "localhost",
      port: Number.parseInt(process.env.MINIO_PORT || "9000", 10),
      bucket: process.env.MINIO_BUCKET || "voflow",
      useSSL: process.env.MINIO_USE_SSL === "true",
      errorMessage: "connect ECONNREFUSED 127.0.0.1:9000",
    });
  });
});
