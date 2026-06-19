import { randomUUID } from "node:crypto";

export function createWorkflowTraceId(): string {
  return `trace_${randomUUID()}`;
}
