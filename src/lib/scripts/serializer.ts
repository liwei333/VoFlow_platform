import { Script, ScriptSourceType, ScriptStatus } from "@prisma/client";

export interface SerializedScript {
  id: string;
  projectId: string;
  jobId: string | null;
  sourceType: ScriptSourceType;
  content: string;
  metadata: unknown;
  version: number;
  status: ScriptStatus;
  createdAt: string;
  updatedAt: string;
}

export function serializeScript(script: Script): SerializedScript {
  return {
    id: script.id,
    projectId: script.projectId,
    jobId: script.jobId,
    sourceType: script.sourceType,
    content: script.content,
    metadata: script.metadata,
    version: script.version,
    status: script.status,
    createdAt: script.createdAt.toISOString(),
    updatedAt: script.updatedAt.toISOString(),
  };
}
