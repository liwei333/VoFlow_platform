import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  runPackagingExportE2eScenario,
  type PackagingExportE2eScenarioResult,
} from "@/services/exportE2eScenarioService";

describe("packaging export e2e script", () => {
  let scenario: PackagingExportE2eScenarioResult | null = null;

  afterEach(async () => {
    if (!scenario) {
      return;
    }

    const { ids } = scenario;
    await prisma.exportRequest.deleteMany({ where: { jobId: ids.jobId } });
    await prisma.editingConfig.deleteMany({ where: { jobId: ids.jobId } });
    await prisma.avatarRenderRequest.deleteMany({ where: { jobId: ids.jobId } });
    await prisma.ttsRequest.deleteMany({ where: { jobId: ids.jobId } });
    await prisma.artifact.deleteMany({ where: { jobId: ids.jobId } });
    await prisma.workflowNode.deleteMany({ where: { jobId: ids.jobId } });
    await prisma.avatar.deleteMany({ where: { id: ids.avatarId } });
    await prisma.asset.deleteMany({ where: { id: ids.avatarSourceAssetId } });
    await prisma.voice.deleteMany({ where: { id: ids.voiceId } });
    await prisma.scriptCandidate.deleteMany({ where: { id: ids.scriptCandidateId } });
    await prisma.script.deleteMany({ where: { id: ids.scriptId } });
    await prisma.videoJob.deleteMany({ where: { id: ids.jobId } });
    await prisma.project.deleteMany({ where: { id: ids.projectId } });
    await prisma.teamMember.deleteMany({ where: { teamId: ids.teamId } });
    await prisma.team.deleteMany({ where: { id: ids.teamId } });
    await prisma.user.deleteMany({ where: { id: ids.userId } });
    scenario = null;
  });

  it("runs from project, script, photo, and voice fixtures to a final_video artifact", async () => {
    scenario = await runPackagingExportE2eScenario();

    expect(scenario.providers).toEqual({
      asr: "mock-asr",
      llm: "mock-llm",
      tts: "mock-tts",
      avatar: "mock-avatar",
      ffmpeg: "mock-ffmpeg",
    });
    expect(scenario.exportRequest.status).toBe("succeeded");
    expect(scenario.exportRequest.outputProfile).toBe("mp4_1080p");

    expect(scenario.nodes.map((node) => `${node.nodeType}:${node.status}`)).toEqual(
      expect.arrayContaining([
        "script_prepare:succeeded",
        "script_rewrite:succeeded",
        "tts:succeeded",
        "avatar_render:succeeded",
        "subtitle:succeeded",
        "bgm_mix:succeeded",
        "cover:succeeded",
        "final_export:succeeded",
      ])
    );
    expect(scenario.artifacts.map((artifact) => artifact.type)).toEqual(
      expect.arrayContaining([
        "audio",
        "avatar_video",
        "subtitle",
        "mixed_audio",
        "cover",
        "final_video",
      ])
    );

    const finalVideo = scenario.artifacts.find((artifact) => artifact.type === "final_video");
    expect(finalVideo).toMatchObject({
      storageUrl: expect.stringContaining("final_video.mp4"),
      metadata: expect.objectContaining({
        exportRequestId: scenario.exportRequest.id,
        outputProfile: "mp4_1080p",
      }),
    });
  });
});
