export const LEGAL_REVIEW_NODE_TYPE = "legal_review";

export const LEGAL_REVIEW_STATUSES = {
  pending: "pending",
  reviewed: "reviewed",
  waitingApproval: "waiting_approval",
  approved: "approved",
} as const;

export const LEGAL_RISK_TYPES = {
  forbidden: "forbidden",
  sensitive: "sensitive",
  exaggeration: "exaggeration",
  copyright: "copyright",
  fact: "fact",
  platformRule: "platform_rule",
} as const;

export const LEGAL_RISK_SEVERITIES = {
  low: "low",
  medium: "medium",
  high: "high",
} as const;

export const LEGAL_RISK_ACTIONS = {
  pending: "pending",
  replaced: "replaced",
  ignored: "ignored",
  confirmedSafe: "confirmed_safe",
} as const;

export const LEGAL_RISK_RESOLVE_ACTION_VALUES = [
  LEGAL_RISK_ACTIONS.replaced,
  LEGAL_RISK_ACTIONS.ignored,
  LEGAL_RISK_ACTIONS.confirmedSafe,
] as const;

export type LegalRiskResolveAction = (typeof LEGAL_RISK_RESOLVE_ACTION_VALUES)[number];

export const LEGAL_REVIEW_ERROR_CODES = {
  candidateNotFound: "LEGAL_CANDIDATE_NOT_FOUND",
  reviewNotFound: "LEGAL_REVIEW_NOT_FOUND",
  riskItemNotFound: "LEGAL_RISK_ITEM_NOT_FOUND",
  ignoreReasonRequired: "LEGAL_IGNORE_REASON_REQUIRED",
  invalidAction: "LEGAL_INVALID_ACTION",
  highRiskUnresolved: "LEGAL_HIGH_RISK_UNRESOLVED",
  ruleEngineFailed: "LEGAL_RULE_ENGINE_FAILED",
  llmReviewFailed: "LEGAL_LLM_REVIEW_FAILED",
} as const;

export type LegalReviewErrorCode =
  (typeof LEGAL_REVIEW_ERROR_CODES)[keyof typeof LEGAL_REVIEW_ERROR_CODES];

export const LEGAL_REVIEW_ERROR_MESSAGES: Record<LegalReviewErrorCode, string> = {
  [LEGAL_REVIEW_ERROR_CODES.candidateNotFound]: "候选文案不存在",
  [LEGAL_REVIEW_ERROR_CODES.reviewNotFound]: "法务审查不存在",
  [LEGAL_REVIEW_ERROR_CODES.riskItemNotFound]: "法务风险项不存在",
  [LEGAL_REVIEW_ERROR_CODES.ignoreReasonRequired]: "忽略风险必须填写原因",
  [LEGAL_REVIEW_ERROR_CODES.invalidAction]: "风险处理动作不合法",
  [LEGAL_REVIEW_ERROR_CODES.highRiskUnresolved]: "存在未处理高风险法务项，不能进入声音生成",
  [LEGAL_REVIEW_ERROR_CODES.ruleEngineFailed]: "法务规则扫描失败",
  [LEGAL_REVIEW_ERROR_CODES.llmReviewFailed]: "本地 LLM 法务解释失败",
};

export const LEGAL_RISK_TYPE_LABELS: Record<string, string> = {
  [LEGAL_RISK_TYPES.forbidden]: "违禁词",
  [LEGAL_RISK_TYPES.sensitive]: "敏感词",
  [LEGAL_RISK_TYPES.exaggeration]: "夸大宣传",
  [LEGAL_RISK_TYPES.copyright]: "版权风险",
  [LEGAL_RISK_TYPES.fact]: "事实风险",
  [LEGAL_RISK_TYPES.platformRule]: "平台规则",
};

export const LEGAL_RISK_SEVERITY_LABELS: Record<string, string> = {
  [LEGAL_RISK_SEVERITIES.low]: "低",
  [LEGAL_RISK_SEVERITIES.medium]: "中",
  [LEGAL_RISK_SEVERITIES.high]: "高",
};

export const LEGAL_RISK_ACTION_LABELS: Record<string, string> = {
  [LEGAL_RISK_ACTIONS.pending]: "待处理",
  [LEGAL_RISK_ACTIONS.replaced]: "已替换",
  [LEGAL_RISK_ACTIONS.ignored]: "已忽略",
  [LEGAL_RISK_ACTIONS.confirmedSafe]: "确认安全",
};

export const LEGAL_RISK_TYPE_ORDER = [
  LEGAL_RISK_TYPES.forbidden,
  LEGAL_RISK_TYPES.sensitive,
  LEGAL_RISK_TYPES.exaggeration,
  LEGAL_RISK_TYPES.copyright,
  LEGAL_RISK_TYPES.fact,
  LEGAL_RISK_TYPES.platformRule,
] as const;
