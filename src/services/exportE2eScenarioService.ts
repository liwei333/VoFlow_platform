import { Prisma, type ExportOutputProfile } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { WorkflowQueuePayload } from "@/lib/queue/adapter";
import {
  EXPORT_ARTIFACT_TYPES,
  EXPORT_FINAL_VIDEO_FILE_NAME,
  EXPORT_WORKFLOW_NODE_TYPES,
} from "@/lib/export/constants";
import { createAssSubtitleArtifactForJob } from "@/services/exportSubtitleService";
import { createFinalExportTask } from "@/services/exportTaskService";
import { createFinalExportWorkflowNodeHandler } from "@/services/exportWorkerService";
import { executeWorkflowNode } from "@/services/workflowWorkerService";

export interface PackagingExportE2eScenarioResult {
  ids: {
    userId: string;
    teamId: string;
    projectId: string;
    jobId: string;
    avatarSourceAssetId: string;
    avatarId: string;
    voiceId: string;
    scriptId: string;
    scriptCandidateId: string;
  };
  providers: {
    asr: "mock-asr";
    llm: "mock-llm";
    tts: "mock-tts";
    avatar: "mock-avatar";
    ffmpeg: "mock-ffmpeg";
  };
  exportRequest: {
    id: string;
    status: string;
    outputProfile: ExportOutputProfile;
  };
  nodes: Array<{
    id: string;
    nodeType: string;
    status: string;
  }>;
  artifacts: Array<{
    id: string;
    type: string;
    storageUrl: string;
    metadata: unknown;
  }>;
}

export async function runPackagingExportE2eScenario(): Promise<PackagingExportE2eScenarioResult> {
  const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const user = await prisma.user.create({
    data: {
      email: `packaging_export_e2e_${unique}@example.com`,
      passwordHash: "hashed_password",
      name: "Packaging Export E2E User",
    },
  });
  const team = await prisma.team.create({
    data: {
      name: "Packaging Export E2E Team",
      ownerId: user.id,
      members: {
        create: {
          userId: user.id,
          role: "owner",
        },
      },
    },
  });
  const project = await prisma.project.create({
    data: {
      teamId: team.id,
      ownerId: user.id,
      name: "Packaging Export E2E Project",
      targetPlatform: "douyin",
      aspectRatio: "ratio_9_16",
    },
  });
  const job = await prisma.videoJob.create({
    data: {
      projectId: project.id,
      teamId: team.id,
      ownerId: user.id,
      status: "running",
      currentNode: "script_prepare",
    },
  });
  const avatarSourceAsset = await prisma.asset.create({
    data: {
      teamId: team.id,
      ownerId: user.id,
      type: "avatar_source",
      name: "e2e-avatar-source.png",
      storageUrl: `voflow/${team.id}/assets/e2e-avatar-source.png`,
      mimeType: "image/png",
      sizeBytes: BigInt(2048),
      licenseStatus: "approved",
      metadata: {
        provider: "mock-asr",
        fixture: "avatar-source-photo",
      },
    },
  });
  const avatar = await prisma.avatar.create({
    data: {
      teamId: team.id,
      ownerId: user.id,
      name: "E2E Mock Avatar",
      sourceAssetId: avatarSourceAsset.id,
      provider: "mock-avatar",
      status: "ready",
      licenseStatus: "approved",
      qualityReport: {
        passed: true,
        faceCount: 1,
      },
    },
  });
  const voice = await prisma.voice.create({
    data: {
      teamId: team.id,
      ownerId: user.id,
      voiceType: "cloned",
      name: "E2E Mock Voice",
      provider: "mock-tts",
      modelId: "mock-tts-voice",
      status: "active",
      licenseStatus: "approved",
    },
  });
  const script = await prisma.script.create({
    data: {
      projectId: project.id,
      jobId: job.id,
      sourceType: "pasted",
      content: "Open with the product benefit. Show the use case. Close with a short call to action.",
      status: "approved",
      metadata: {
        provider: "mock-asr",
      },
    },
  });
  const scriptCandidate = await prisma.scriptCandidate.create({
    data: {
      scriptId: script.id,
      content: "Open with the product benefit. Show the use case. Close with a short call to action.",
      titleCandidates: ["E2E Final Cover"],
      modelName: "mock-llm",
      status: "approved",
    },
  });

  await createSucceededNode(job.id, "script_prepare", {
    provider: "mock-asr",
    scriptId: script.id,
  });
  await createSucceededNode(job.id, "script_rewrite", {
    provider: "mock-llm",
    scriptCandidateId: scriptCandidate.id,
  });
  const ttsNode = await createSucceededNode(job.id, "tts", {
    provider: "mock-tts",
  });
  const audioArtifact = await prisma.artifact.create({
    data: {
      jobId: job.id,
      nodeId: ttsNode.id,
      type: "audio",
      storageUrl: `voflow/${team.id}/jobs/${job.id}/tts/audio.wav`,
      metadata: {
        provider: "mock-tts",
        durationMs: 4200,
      },
    },
  });
  await prisma.ttsRequest.create({
    data: {
      jobId: job.id,
      nodeId: ttsNode.id,
      voiceId: voice.id,
      scriptCandidateId: scriptCandidate.id,
      provider: "mock-tts",
      providerRequestId: `mock-tts-${unique}`,
      status: "succeeded",
      audioArtifactId: audioArtifact.id,
    },
  });

  const avatarNode = await createSucceededNode(job.id, "avatar_render", {
    provider: "mock-avatar",
  });
  await prisma.avatarRenderRequest.create({
    data: {
      jobId: job.id,
      nodeId: avatarNode.id,
      avatarId: avatar.id,
      audioArtifactId: audioArtifact.id,
      mode: "hd",
      aspectRatio: "ratio_9_16",
      crop: "half_body",
      provider: "mock-avatar",
      providerRequestId: `mock-avatar-${unique}`,
    },
  });
  await prisma.artifact.create({
    data: {
      jobId: job.id,
      nodeId: avatarNode.id,
      type: "avatar_video",
      storageUrl: `voflow/${team.id}/jobs/${job.id}/avatar_render/avatar.mp4`,
      metadata: {
        provider: "mock-avatar",
        durationMs: 4200,
      },
    },
  });

  const subtitleNode = await createSucceededNode(job.id, EXPORT_WORKFLOW_NODE_TYPES.subtitle, {
    provider: "mock-ffmpeg",
  });
  const subtitle = await createAssSubtitleArtifactForJob(
    {
      jobId: job.id,
      teamId: team.id,
      nodeId: subtitleNode.id,
    },
    {
      uploadSubtitle: async (input) =>
        `voflow/${input.teamId}/jobs/${input.jobId}/subtitle/${input.fileName}`,
    }
  );
  if (!subtitle.success) {
    throw new Error(subtitle.error.message);
  }

  const bgmMixNode = await createSucceededNode(job.id, EXPORT_WORKFLOW_NODE_TYPES.bgmMix, {
    provider: "mock-ffmpeg",
  });
  await prisma.artifact.create({
    data: {
      jobId: job.id,
      nodeId: bgmMixNode.id,
      type: EXPORT_ARTIFACT_TYPES.mixedAudio,
      storageUrl: `voflow/${team.id}/jobs/${job.id}/bgm_mix/mixed_audio.wav`,
      metadata: {
        voiceAudioArtifactId: audioArtifact.id,
        provider: "mock-ffmpeg",
      },
    },
  });

  const coverNode = await createSucceededNode(job.id, EXPORT_WORKFLOW_NODE_TYPES.cover, {
    provider: "mock-ffmpeg",
  });
  const coverArtifact = await prisma.artifact.create({
    data: {
      jobId: job.id,
      nodeId: coverNode.id,
      type: EXPORT_ARTIFACT_TYPES.cover,
      storageUrl: `voflow/${team.id}/jobs/${job.id}/cover/cover_title.jpg`,
      metadata: {
        titleText: "E2E Final Cover",
        stage: "title_frame",
      },
    },
  });

  await prisma.editingConfig.create({
    data: {
      jobId: job.id,
      subtitleEnabled: true,
      keywordHighlightEnabled: true,
      bgmDuckingEnabled: true,
      voiceVolume: 100,
      bgmVolume: 35,
      transitionStrength: 50,
      configJson: {
        e2eFixture: true,
      },
    },
  });

  const queuedPayloads: WorkflowQueuePayload[] = [];
  const exportTask = await createFinalExportTask(
    {
      jobId: job.id,
      teamId: team.id,
      outputProfile: "mp4_1080p",
      coverArtifactId: coverArtifact.id,
    },
    {
      queue: {
        enqueue: async (payload) => {
          queuedPayloads.push(payload);
        },
      },
      createTraceId: () => `trace-packaging-export-e2e-${unique}`,
    }
  );
  if (!exportTask.success) {
    throw new Error(exportTask.error.message);
  }

  const payload = queuedPayloads[0];
  if (!payload) {
    throw new Error("Final export queue payload was not created");
  }

  const finalExportHandler = createFinalExportWorkflowNodeHandler({
    materializeObject: async (storageUrl) => `/tmp/${storageUrl.split("/").at(-1) ?? "input"}`,
    executeFfmpeg: async () => undefined,
    readOutputFile: async () => Buffer.from("mock-final-video-mp4"),
    validateFinalVideo: async () => ({ valid: true }),
    uploadFinalVideo: async (input) =>
      `voflow/${input.teamId}/jobs/${input.jobId}/final_export/${EXPORT_FINAL_VIDEO_FILE_NAME}`,
  });
  const execution = await executeWorkflowNode(payload, {
    handlers: {
      final_export: finalExportHandler,
    },
  });
  if (!execution.success) {
    throw new Error(execution.error.message);
  }

  const [exportRequest, nodes, artifacts] = await Promise.all([
    prisma.exportRequest.findFirstOrThrow({
      where: {
        jobId: job.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        status: true,
        outputProfile: true,
      },
    }),
    prisma.workflowNode.findMany({
      where: {
        jobId: job.id,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        nodeType: true,
        status: true,
      },
    }),
    prisma.artifact.findMany({
      where: {
        jobId: job.id,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        type: true,
        storageUrl: true,
        metadata: true,
      },
    }),
  ]);

  await prisma.videoJob.update({
    where: {
      id: job.id,
    },
    data: {
      status: "succeeded",
      currentNode: EXPORT_WORKFLOW_NODE_TYPES.finalExport,
      progress: 100,
    },
  });

  return {
    ids: {
      userId: user.id,
      teamId: team.id,
      projectId: project.id,
      jobId: job.id,
      avatarSourceAssetId: avatarSourceAsset.id,
      avatarId: avatar.id,
      voiceId: voice.id,
      scriptId: script.id,
      scriptCandidateId: scriptCandidate.id,
    },
    providers: {
      asr: "mock-asr",
      llm: "mock-llm",
      tts: "mock-tts",
      avatar: "mock-avatar",
      ffmpeg: "mock-ffmpeg",
    },
    exportRequest,
    nodes,
    artifacts,
  };
}

async function createSucceededNode(jobId: string, nodeType: string, output: unknown) {
  return prisma.workflowNode.create({
    data: {
      jobId,
      nodeType,
      status: "succeeded",
      version: 1,
      output: toPrismaJson(output),
      finishedAt: new Date(),
    },
    select: {
      id: true,
    },
  });
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}
