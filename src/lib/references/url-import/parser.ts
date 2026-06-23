import {
  DEFAULT_REFERENCE_LINK_PARSERS,
  type ReferenceLinkParser,
  type ReferenceLinkParserInput,
} from "@/lib/references/parser";
import {
  REFERENCE_PLATFORMS,
  type ReferencePlatform,
} from "@/lib/references/platforms";
import { buildReferenceLinkImportConfig } from "@/lib/references/url-import/config";
import {
  normalizeYtDlpMetadata,
  ytDlpMetadataToParsedData,
} from "@/lib/references/url-import/metadata";
import { YtDlpClient } from "@/lib/references/url-import/ytdlp-client";

export interface YtDlpMetadataClient {
  getMetadata(sourceUrl: string): Promise<Record<string, unknown>>;
}

export function createYtDlpReferenceLinkParser(options: {
  client: YtDlpMetadataClient;
  maxMetadataBytes: number;
}): ReferenceLinkParser {
  return {
    async parse(input: ReferenceLinkParserInput) {
      const metadata = await options.client.getMetadata(input.normalizedUrl);
      const normalized = normalizeYtDlpMetadata(metadata, {
        normalizedUrl: input.normalizedUrl,
        maxMetadataBytes: options.maxMetadataBytes,
      });

      return ytDlpMetadataToParsedData(normalized);
    },
  };
}

const defaultYtDlpReferenceLinkParser: ReferenceLinkParser = {
  async parse(input) {
    const config = buildReferenceLinkImportConfig();
    const client = new YtDlpClient({
      ytdlpBin: config.ytdlpBin,
      timeoutMs: config.timeoutMs,
      maxMetadataBytes: config.maxMetadataBytes,
    });

    return createYtDlpReferenceLinkParser({
      client,
      maxMetadataBytes: config.maxMetadataBytes,
    }).parse(input);
  },
};

export const DEFAULT_REFERENCE_URL_IMPORT_PARSERS: Record<
  ReferencePlatform,
  ReferenceLinkParser
> = REFERENCE_PLATFORMS.reduce((registry, platform) => {
  registry[platform] =
    DEFAULT_REFERENCE_LINK_PARSERS[platform] ?? defaultYtDlpReferenceLinkParser;
  return registry;
}, {} as Record<ReferencePlatform, ReferenceLinkParser>);

for (const platform of REFERENCE_PLATFORMS) {
  DEFAULT_REFERENCE_URL_IMPORT_PARSERS[platform] = defaultYtDlpReferenceLinkParser;
}
