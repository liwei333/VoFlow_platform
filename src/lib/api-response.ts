import { NextResponse } from "next/server";

const API_CODES = {
  success: "SUCCESS",
  notFound: "NOT_FOUND",
  internalError: "INTERNAL_ERROR",
  validationError: "VALIDATION_ERROR",
} as const;

const DEFAULT_NOT_FOUND_MESSAGE = "素材不存在";
const DEFAULT_INTERNAL_ERROR_MESSAGE = "服务器内部错误";
const DEFAULT_VALIDATION_ERROR_MESSAGE = "参数错误";
const INVALID_JSON_BODY_ERRORS = [
  {
    path: ["body"],
    message: "请求体必须是有效 JSON",
  },
];

export function success<T>(data?: T, message?: string): NextResponse {
  return NextResponse.json({
    code: API_CODES.success,
    ...(message ? { message } : {}),
    ...(data === undefined ? {} : { data }),
  });
}

export function notFound(message = DEFAULT_NOT_FOUND_MESSAGE): NextResponse {
  return NextResponse.json(
    {
      code: API_CODES.notFound,
      message,
    },
    { status: 404 }
  );
}

export function internalError(message = DEFAULT_INTERNAL_ERROR_MESSAGE): NextResponse {
  return NextResponse.json(
    {
      code: API_CODES.internalError,
      message,
    },
    { status: 500 }
  );
}

export function validationError(errors: unknown, message = DEFAULT_VALIDATION_ERROR_MESSAGE): NextResponse {
  return NextResponse.json(
    {
      code: API_CODES.validationError,
      message,
      errors,
    },
    { status: 400 }
  );
}

export function invalidJsonBody(): NextResponse {
  return validationError(INVALID_JSON_BODY_ERRORS);
}
