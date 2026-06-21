import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  REFERENCE_LINK_PARSE_ERROR_CODES,
  REFERENCE_LINK_PARSE_ERROR_MESSAGES,
  REFERENCE_LINK_PARSE_FALLBACK,
  parseReferenceLink,
  type ParseReferenceLinkResult,
} from "@/lib/references/parser";
import {
  REFERENCE_PLATFORM_ERROR_MESSAGES,
  type ReferencePlatformErrorCode,
  ReferencePlatformError,
} from "@/lib/references/platforms";

export type CreateReferenceFromUrlErrorCode =
  | "PROJECT_NOT_FOUND"
  | ReferencePlatformErrorCode
  | "REFERENCE_PARSE_FAILED"
  | "REFERENCE_SOURCE_CREATE_FAILED";

export type CreateReferenceFromUrlResult =
  | {
      success: true;
      data: {
        referenceSource: ReferenceSourceSummary;
        parsed: Extract<ParseReferenceLinkResult, { success: true }>;
      };
    }
  | {
      success: false;
      error: {
        code: CreateReferenceFromUrlErrorCode;
        message: string;
        detail?: string;
      };
      data?: {
        platform?: string;
        label?: string;
        normalizedUrl?: string;
        fallback?: typeof REFERENCE_LINK_PARSE_FALLBACK;
      };
    };

export type GetReferenceSourceResult =
  | {
      success: true;
      data: {
        referenceSource: ReferenceSourceDetail;
      };
    }
  | {
      success: false;
      error: {
        code: "REFERENCE_SOURCE_NOT_FOUND";
        message: string;
      };
    };

export interface ReferenceSourceSummary {
  id: string;
  projectId: string;
  teamId: string;
  sourceType: string;
  platform: string | null;
  sourceUrl: string | null;
  assetId: string | null;
  status: string;
  durationMs: number | null;
  structureJson: unknown;
  errorJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferenceSourceDetail extends ReferenceSourceSummary {
  transcript: string | null;
}

export async function createReferenceSourceFromUrl(input: {
  projectId: string;
  teamId: string;
  sourceUrl: string;
}): Promise<CreateReferenceFromUrlResult> {
  const project = await prisma.project.findFirst({
    where: {
      id: input.projectId,
      teamId: input.teamId,
      status: "active",
    },
    select: {
      id: true,
    },
  });

  if (!project) {
    return {
      success: false,
      error: {
        code: "PROJECT_NOT_FOUND",
        message: "项目不存在",
      },
    };
  }

  let parsed: ParseReferenceLinkResult;
  try {
    parsed = await parseReferenceLink(input.sourceUrl);
  } catch (error) {
    if (error instanceof ReferencePlatformError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: REFERENCE_PLATFORM_ERROR_MESSAGES[error.code],
          detail: error.message,
        },
        data: {
          fallback: REFERENCE_LINK_PARSE_FALLBACK,
        },
      };
    }

    return {
      success: false,
      error: {
        code: REFERENCE_LINK_PARSE_ERROR_CODES.PARSE_FAILED,
        message: REFERENCE_LINK_PARSE_ERROR_MESSAGES[
          REFERENCE_LINK_PARSE_ERROR_CODES.PARSE_FAILED
        ],
        detail: getErrorDetail(error),
      },
      data: {
        fallback: REFERENCE_LINK_PARSE_FALLBACK,
      },
    };
  }

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error,
      data: {
        platform: parsed.platform,
        label: parsed.label,
        normalizedUrl: parsed.normalizedUrl,
        fallback: parsed.fallback,
      },
    };
  }

  try {
    const referenceSource = await prisma.referenceSource.create({
      data: {
        projectId: input.projectId,
        teamId: input.teamId,
        sourceType: "url",
        platform: parsed.platform,
        sourceUrl: parsed.normalizedUrl,
        status: "succeeded",
        durationMs: parsed.parsed.durationMs ?? null,
        structureJson: toPrismaJson({
          platform: parsed.platform,
          label: parsed.label,
          normalizedUrl: parsed.normalizedUrl,
          normalizedHost: parsed.normalizedHost,
          title: parsed.parsed.title ?? null,
          mediaUrl: parsed.parsed.mediaUrl ?? null,
          thumbnailUrl: parsed.parsed.thumbnailUrl ?? null,
          raw: parsed.parsed.raw ?? null,
        }),
      },
      select: referenceSourceSummarySelect,
    });

    return {
      success: true,
      data: {
        referenceSource,
        parsed,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "REFERENCE_SOURCE_CREATE_FAILED",
        message: "参考链接保存失败",
        detail: getErrorDetail(error),
      },
    };
  }
}

export async function getReferenceSourceForTeam(input: {
  referenceSourceId: string;
  teamId: string;
}): Promise<GetReferenceSourceResult> {
  const referenceSource = await prisma.referenceSource.findFirst({
    where: {
      id: input.referenceSourceId,
      teamId: input.teamId,
    },
    select: {
      ...referenceSourceSummarySelect,
      transcriptScript: {
        select: {
          content: true,
        },
      },
    },
  });

  if (!referenceSource) {
    return {
      success: false,
      error: {
        code: "REFERENCE_SOURCE_NOT_FOUND",
        message: "参考来源不存在",
      },
    };
  }

  const { transcriptScript, ...summary } = referenceSource;
  return {
    success: true,
    data: {
      referenceSource: {
        ...summary,
        transcript: transcriptScript?.content ?? null,
      },
    },
  };
}

const referenceSourceSummarySelect = {
  id: true,
  projectId: true,
  teamId: true,
  sourceType: true,
  platform: true,
  sourceUrl: true,
  assetId: true,
  status: true,
  durationMs: true,
  structureJson: true,
  errorJson: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ReferenceSourceSelect;

function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

function getErrorDetail(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown reference source error";
}
