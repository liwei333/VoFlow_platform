import {
  REFERENCE_PLATFORMS,
  detectReferencePlatform,
  type ReferencePlatform,
} from "@/lib/references/platforms";

export const REFERENCE_LINK_PARSE_ERROR_CODES = {
  PARSE_FAILED: "REFERENCE_PARSE_FAILED",
} as const;

export type ReferenceLinkParseErrorCode =
  (typeof REFERENCE_LINK_PARSE_ERROR_CODES)[keyof typeof REFERENCE_LINK_PARSE_ERROR_CODES];

export const REFERENCE_LINK_PARSE_ERROR_MESSAGES: Record<
  ReferenceLinkParseErrorCode,
  string
> = {
  [REFERENCE_LINK_PARSE_ERROR_CODES.PARSE_FAILED]:
    "链接解析失败，请改用上传视频/音频或粘贴文案。",
};

export const REFERENCE_LINK_PARSE_FALLBACK = {
  action: "upload_media_or_paste_text",
  message: "请上传视频/音频或直接粘贴文案继续提取。",
} as const;

export interface ReferenceLinkParserInput {
  sourceUrl: string;
  platform: ReferencePlatform;
  adapterKey: ReferencePlatform;
  normalizedUrl: string;
  normalizedHost: string;
}

export interface ReferenceLinkParsedData {
  title?: string;
  durationMs?: number;
  mediaUrl?: string;
  thumbnailUrl?: string;
  raw?: unknown;
}

export interface ReferenceLinkParser {
  parse(input: ReferenceLinkParserInput): Promise<ReferenceLinkParsedData>;
}

export type ReferenceLinkParserRegistry = Partial<Record<ReferencePlatform, ReferenceLinkParser>>;

export interface ParseReferenceLinkOptions {
  adapters?: ReferenceLinkParserRegistry;
}

export type ParseReferenceLinkResult =
  | {
      success: true;
      sourceUrl: string;
      platform: ReferencePlatform;
      label: string;
      normalizedUrl: string;
      normalizedHost: string;
      parsed: ReferenceLinkParsedData;
    }
  | {
      success: false;
      sourceUrl: string;
      platform: ReferencePlatform;
      label: string;
      normalizedUrl: string;
      normalizedHost: string;
      error: {
        code: ReferenceLinkParseErrorCode;
        message: string;
        detail: string;
      };
      fallback: typeof REFERENCE_LINK_PARSE_FALLBACK;
    };

const defaultReferenceLinkParser: ReferenceLinkParser = {
  async parse(input) {
    throw new Error(`No parser configured for ${input.platform}`);
  },
};

export const DEFAULT_REFERENCE_LINK_PARSERS: Record<ReferencePlatform, ReferenceLinkParser> =
  REFERENCE_PLATFORMS.reduce((registry, platform) => {
    registry[platform] = defaultReferenceLinkParser;
    return registry;
  }, {} as Record<ReferencePlatform, ReferenceLinkParser>);

export async function parseReferenceLink(
  sourceUrl: string,
  options: ParseReferenceLinkOptions = {}
): Promise<ParseReferenceLinkResult> {
  const detection = detectReferencePlatform(sourceUrl);
  const input: ReferenceLinkParserInput = {
    sourceUrl,
    platform: detection.platform,
    adapterKey: detection.adapterKey,
    normalizedUrl: detection.normalizedUrl,
    normalizedHost: detection.normalizedHost,
  };
  const parser =
    options.adapters?.[detection.adapterKey] ?? DEFAULT_REFERENCE_LINK_PARSERS[detection.adapterKey];

  try {
    const parsed = await parser.parse(input);

    return {
      success: true,
      sourceUrl,
      platform: detection.platform,
      label: detection.label,
      normalizedUrl: detection.normalizedUrl,
      normalizedHost: detection.normalizedHost,
      parsed,
    };
  } catch (error) {
    return {
      success: false,
      sourceUrl,
      platform: detection.platform,
      label: detection.label,
      normalizedUrl: detection.normalizedUrl,
      normalizedHost: detection.normalizedHost,
      error: {
        code: REFERENCE_LINK_PARSE_ERROR_CODES.PARSE_FAILED,
        message: REFERENCE_LINK_PARSE_ERROR_MESSAGES[
          REFERENCE_LINK_PARSE_ERROR_CODES.PARSE_FAILED
        ],
        detail: getErrorDetail(error),
      },
      fallback: REFERENCE_LINK_PARSE_FALLBACK,
    };
  }
}

function getErrorDetail(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown parser error";
}
