import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  serializePublishDraft,
  type PublishDraftRecord,
  type SerializedPublishDraft,
} from "@/lib/publish/serializer";
import { PUBLISH_PLATFORMS, getPublishPlatformRule } from "@/lib/publish/rules";

export const PUBLISH_DRAFT_ERROR_CODES = {
  jobNotFound: "PUBLISH_JOB_NOT_FOUND",
  draftNotFound: "PUBLISH_DRAFT_NOT_FOUND",
  titleTooLong: "PUBLISH_DRAFT_TITLE_TOO_LONG",
  tagsTooMany: "PUBLISH_DRAFT_TAGS_TOO_MANY",
  coverNotFound: "PUBLISH_DRAFT_COVER_NOT_FOUND",
} as const;

export type PublishDraftErrorCode =
  (typeof PUBLISH_DRAFT_ERROR_CODES)[keyof typeof PUBLISH_DRAFT_ERROR_CODES];

export interface GetPublishDraftsInput {
  jobId: string;
  teamId: string;
}

export interface UpdatePublishDraftInput {
  draftId: string;
  teamId: string;
  title?: string;
  description?: string;
  tags?: string[];
  topics?: string[];
  coverArtifactId?: string | null;
}

export type GetPublishDraftsResult =
  | {
      success: true;
      data: {
        drafts: SerializedPublishDraft[];
      };
    }
  | {
      success: false;
      error: {
        code: typeof PUBLISH_DRAFT_ERROR_CODES.jobNotFound;
        message: string;
      };
    };

export type UpdatePublishDraftResult =
  | {
      success: true;
      data: {
        draft: SerializedPublishDraft;
      };
    }
  | {
      success: false;
      error: {
        code: Exclude<PublishDraftErrorCode, typeof PUBLISH_DRAFT_ERROR_CODES.jobNotFound>;
        message: string;
      };
    };

const PUBLISH_DRAFT_SELECT = {
  id: true,
  jobId: true,
  platform: true,
  title: true,
  description: true,
  tagsJson: true,
  topicsJson: true,
  coverArtifactId: true,
  validationJson: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PublishDraftSelect;

export async function getPublishDraftsForJob(
  input: GetPublishDraftsInput
): Promise<GetPublishDraftsResult> {
  const job = await prisma.videoJob.findFirst({
    where: {
      id: input.jobId,
      teamId: input.teamId,
    },
    select: {
      id: true,
    },
  });

  if (!job) {
    return {
      success: false,
      error: {
        code: PUBLISH_DRAFT_ERROR_CODES.jobNotFound,
        message: "视频任务不存在",
      },
    };
  }

  const drafts = await prisma.publishDraft.findMany({
    where: {
      jobId: input.jobId,
    },
    select: PUBLISH_DRAFT_SELECT,
  });

  const sortedDrafts = drafts.sort(
    (a, b) =>
      PUBLISH_PLATFORMS.indexOf(a.platform) - PUBLISH_PLATFORMS.indexOf(b.platform)
  );

  return {
    success: true,
    data: {
      drafts: sortedDrafts.map((draft) => serializePublishDraft(draft as PublishDraftRecord)),
    },
  };
}

export async function updatePublishDraft(
  input: UpdatePublishDraftInput
): Promise<UpdatePublishDraftResult> {
  const draft = await prisma.publishDraft.findFirst({
    where: {
      id: input.draftId,
      job: {
        teamId: input.teamId,
      },
    },
    select: PUBLISH_DRAFT_SELECT,
  });

  if (!draft) {
    return {
      success: false,
      error: {
        code: PUBLISH_DRAFT_ERROR_CODES.draftNotFound,
        message: "发布草稿不存在",
      },
    };
  }

  const rule = getPublishPlatformRule(draft.platform);
  const updateData: Prisma.PublishDraftUpdateInput = {
    validationJson: Prisma.DbNull,
  };

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (Array.from(title).length > rule.title.maxChars) {
      return {
        success: false,
        error: {
          code: PUBLISH_DRAFT_ERROR_CODES.titleTooLong,
          message: "标题超过平台限制",
        },
      };
    }
    updateData.title = title;
  }

  if (input.description !== undefined) {
    updateData.description = input.description.trim();
  }

  if (input.tags !== undefined) {
    const tags = uniqueStrings(input.tags);
    if (tags.length > rule.tags.maxCount) {
      return {
        success: false,
        error: {
          code: PUBLISH_DRAFT_ERROR_CODES.tagsTooMany,
          message: "标签数量超过平台限制",
        },
      };
    }
    updateData.tagsJson = toPrismaJson(tags);
  }

  if (input.topics !== undefined) {
    updateData.topicsJson = toPrismaJson(uniqueStrings(input.topics));
  }

  if (Object.prototype.hasOwnProperty.call(input, "coverArtifactId")) {
    if (input.coverArtifactId === null || input.coverArtifactId === undefined) {
      updateData.coverArtifact = {
        disconnect: true,
      };
    } else {
      const coverArtifact = await prisma.artifact.findFirst({
        where: {
          id: input.coverArtifactId,
          jobId: draft.jobId,
          type: "cover",
        },
        select: {
          id: true,
        },
      });

      if (!coverArtifact) {
        return {
          success: false,
          error: {
            code: PUBLISH_DRAFT_ERROR_CODES.coverNotFound,
            message: "封面素材不存在",
          },
        };
      }

      updateData.coverArtifact = {
        connect: {
          id: coverArtifact.id,
        },
      };
    }
  }

  const saved = await prisma.publishDraft.update({
    where: {
      id: draft.id,
    },
    data: updateData,
    select: PUBLISH_DRAFT_SELECT,
  });

  return {
    success: true,
    data: {
      draft: serializePublishDraft(saved as PublishDraftRecord),
    },
  };
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;

    seen.add(normalized);
    unique.push(normalized);
  }

  return unique;
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
