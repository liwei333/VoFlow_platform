import { describe, expect, it } from "vitest";
import {
  internalError,
  invalidJsonBody,
  notFound,
  success,
  validationError,
} from "@/lib/api-response";

describe("API response helpers", () => {
  it("returns a SUCCESS response with optional data", async () => {
    const response = success({ asset: { id: "asset-1" } });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      code: "SUCCESS",
      data: { asset: { id: "asset-1" } },
    });
  });

  it("returns a unified NOT_FOUND response", async () => {
    const response = notFound();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "素材不存在",
    });
  });

  it("returns an INTERNAL_ERROR response", async () => {
    const response = internalError();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: "INTERNAL_ERROR",
      message: "服务器内部错误",
    });
  });

  it("returns structured validation errors", async () => {
    const errors = [{ path: ["type"], message: "Required" }];
    const response = validationError(errors);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "VALIDATION_ERROR",
      message: "参数错误",
      errors,
    });
  });

  it("returns a validation error for invalid JSON bodies", async () => {
    const response = invalidJsonBody();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "VALIDATION_ERROR",
      message: "参数错误",
      errors: [
        {
          path: ["body"],
          message: "请求体必须是有效 JSON",
        },
      ],
    });
  });
});
