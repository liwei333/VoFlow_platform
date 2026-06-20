import { NextResponse } from "next/server";
import { notFound } from "@/lib/api-response";
import {
  WORKFLOW_ERROR_CODES,
  type WorkflowError,
} from "@/lib/workflow/errors";

export function workflowActionErrorResponse(error: WorkflowError): NextResponse {
  if (
    error.code === WORKFLOW_ERROR_CODES.WORKFLOW_JOB_NOT_FOUND ||
    error.code === WORKFLOW_ERROR_CODES.WORKFLOW_NODE_NOT_FOUND
  ) {
    return notFound(error.message);
  }

  return NextResponse.json(
    {
      code: error.code,
      message: error.message,
    },
    { status: 400 }
  );
}
