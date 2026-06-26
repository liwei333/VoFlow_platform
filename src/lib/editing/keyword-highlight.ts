import {
  EDITING_KEYWORD_HIGHLIGHT_ASS_STYLE,
  EDITING_KEYWORD_HIGHLIGHT_LIMITS,
} from "@/lib/editing/constants";

export type KeywordHighlightAssStyle = typeof EDITING_KEYWORD_HIGHLIGHT_ASS_STYLE;

export type KeywordHighlightConfig = {
  enabled: boolean;
  keywords: string[];
  assStyle: KeywordHighlightAssStyle;
};

export type ExtractHighlightKeywordsOptions = {
  maxKeywords?: number;
};

export function extractHighlightKeywords(
  scriptContent: string,
  options: ExtractHighlightKeywordsOptions = {}
): string[] {
  const maxKeywords =
    options.maxKeywords ?? EDITING_KEYWORD_HIGHLIGHT_LIMITS.maxKeywords;
  const keywords: string[] = [];

  for (const clause of splitScriptClauses(scriptContent)) {
    addKeywordCandidates(keywords, collectClauseKeywordCandidates(clause), maxKeywords);
    if (keywords.length >= maxKeywords) {
      break;
    }
  }

  return keywords;
}

export function buildKeywordHighlightConfig(input: {
  enabled: boolean;
  scriptContent: string;
}): KeywordHighlightConfig {
  return {
    enabled: input.enabled,
    keywords: input.enabled ? extractHighlightKeywords(input.scriptContent) : [],
    assStyle: EDITING_KEYWORD_HIGHLIGHT_ASS_STYLE,
  };
}

function splitScriptClauses(scriptContent: string): string[] {
  return scriptContent
    .split(/[，。！？、；,.!?;\n\r]+/)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

function collectClauseKeywordCandidates(clause: string): string[] {
  const normalized = normalizeClause(clause);
  if (!normalized || isHookOnlyClause(normalized)) {
    return [];
  }

  const candidates: string[] = [];

  addRegexCandidate(candidates, normalized, /^(.{2,10}?)(?:提升|改善|优化|解决|打造|增强|带来)/u);
  addRegexCandidate(candidates, normalized, /(?:提升|改善|优化)(.{2,8})$/u);
  addRegexCandidate(candidates, normalized, /^(.{2,10}?)(?:让|使)/u);
  addRegexCandidate(candidates, normalized, /(?:让|使)(.{2,8}?更.{1,4})$/u);

  const clearerMatch = normalized.match(/^(.{2,8})更清晰$/u);
  if (clearerMatch?.[1]) {
    candidates.push(clearerMatch[1]);
  } else {
    addRegexCandidate(candidates, normalized, /^(.{2,8}?更.{1,4})$/u);
  }

  if (/^(?:立即|马上|现在).{0,4}(?:下单|购买|领取)$/u.test(normalized)) {
    candidates.push(normalized.slice(0, EDITING_KEYWORD_HIGHLIGHT_LIMITS.maxKeywordLength));
  }

  const suitableMatch = normalized.match(/适合(.{2,4})/u);
  if (suitableMatch?.[1]) {
    candidates.push(`适合${suitableMatch[1].slice(0, 3)}`);
  }

  addRegexCandidate(candidates, normalized, /(?:赠送|送)(.{2,8})$/u);
  if (candidates.length === 0) {
    candidates.push(normalized);
  }

  return candidates
    .map(normalizeKeyword)
    .filter((keyword) => isUsableKeyword(keyword));
}

function addRegexCandidate(candidates: string[], value: string, pattern: RegExp): void {
  const match = value.match(pattern);
  if (match?.[1]) {
    candidates.push(match[1]);
  }
}

function addKeywordCandidates(
  keywords: string[],
  candidates: string[],
  maxKeywords: number
): void {
  for (const candidate of candidates) {
    if (keywords.includes(candidate)) {
      continue;
    }

    keywords.push(candidate);
    if (keywords.length >= maxKeywords) {
      return;
    }
  }
}

function normalizeClause(clause: string): string {
  return clause
    .replace(/\s+/g, "")
    .replace(/^(?:这款|这台|这个|这种|一款|一个|一种)/u, "")
    .replace(/^(?:今天|现在|马上|立即)(?=送|赠送)/u, "");
}

function normalizeKeyword(keyword: string): string {
  return keyword
    .replace(/^(?:这款|这台|这个|这种|一款|一个|一种)/u, "")
    .replace(/^(?:今天|现在|马上|立即)(?=送|赠送)/u, "")
    .trim();
}

function isHookOnlyClause(clause: string): boolean {
  return /^(?:前)?\d+秒/u.test(clause);
}

function isUsableKeyword(keyword: string): boolean {
  return (
    keyword.length >= EDITING_KEYWORD_HIGHLIGHT_LIMITS.minKeywordLength &&
    keyword.length <= EDITING_KEYWORD_HIGHLIGHT_LIMITS.maxKeywordLength &&
    /[\u4e00-\u9fa5]/u.test(keyword)
  );
}
