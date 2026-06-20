export const SCRIPT_RISK_REPORT_TYPE = "script_risk";
export const SCRIPT_RISK_REPORT_VERSION = 1;

export type ScriptRiskStatus = "clear" | "needs_review";
export type ScriptRiskSectionStatus = "clear" | "review_required";
export type ScriptRiskSeverity = "medium" | "high";

export interface ScriptRiskHit {
  category: "sensitive_word";
  term: string;
  severity: ScriptRiskSeverity;
  message: string;
}

export interface ScriptRiskReport {
  reportType: typeof SCRIPT_RISK_REPORT_TYPE;
  version: typeof SCRIPT_RISK_REPORT_VERSION;
  status: ScriptRiskStatus;
  requiresApproval: boolean;
  summary: {
    sensitiveWordCount: number;
    copyrightRisk: ScriptRiskSectionStatus;
    factualRisk: ScriptRiskSectionStatus;
  };
  hits: ScriptRiskHit[];
  copyright: {
    status: ScriptRiskSectionStatus;
    message: string;
  };
  factual: {
    status: ScriptRiskSectionStatus;
    message: string;
  };
}

const MVP_SENSITIVE_WORDS: Array<{ term: string; severity: ScriptRiskSeverity }> = [
  { term: "绝对", severity: "high" },
  { term: "第一", severity: "high" },
  { term: "马上见效", severity: "high" },
  { term: "永久", severity: "medium" },
  { term: "无副作用", severity: "high" },
];

export function buildScriptRiskReport(content: string): ScriptRiskReport {
  const hits = MVP_SENSITIVE_WORDS
    .filter(({ term }) => content.includes(term))
    .map(({ term, severity }) => ({
      category: "sensitive_word" as const,
      term,
      severity,
      message: `命中 MVP 敏感词: ${term}`,
    }));
  const requiresApproval = hits.length > 0;

  return {
    reportType: SCRIPT_RISK_REPORT_TYPE,
    version: SCRIPT_RISK_REPORT_VERSION,
    status: requiresApproval ? "needs_review" : "clear",
    requiresApproval,
    summary: {
      sensitiveWordCount: hits.length,
      copyrightRisk: "review_required",
      factualRisk: "review_required",
    },
    hits,
    copyright: {
      status: "review_required",
      message: "请人工确认文案未使用未授权品牌、素材、人物或第三方版权内容。",
    },
    factual: {
      status: "review_required",
      message: "请人工确认功效、价格、排名、时效等事实性表述有可追溯依据。",
    },
  };
}
