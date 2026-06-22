import {
  LEGAL_RISK_SEVERITIES,
  LEGAL_RISK_TYPES,
  LEGAL_RISK_TYPE_ORDER,
} from "@/lib/legal-review/constants";

export interface LegalRiskRule {
  riskType: (typeof LEGAL_RISK_TYPES)[keyof typeof LEGAL_RISK_TYPES];
  severity: (typeof LEGAL_RISK_SEVERITIES)[keyof typeof LEGAL_RISK_SEVERITIES];
  terms: string[];
  reason: string;
  suggestion: string;
}

export interface LegalRiskFinding {
  riskType: LegalRiskRule["riskType"];
  severity: LegalRiskRule["severity"];
  originalText: string;
  reason: string;
  suggestion: string;
}

export interface LegalReviewSummary {
  requiresApproval: boolean;
  counts: Record<(typeof LEGAL_RISK_TYPE_ORDER)[number], number>;
  highRiskCount: number;
  totalRiskCount: number;
}

export const MVP_LEGAL_RISK_RULES: LegalRiskRule[] = [
  {
    riskType: LEGAL_RISK_TYPES.forbidden,
    severity: LEGAL_RISK_SEVERITIES.high,
    terms: ["违禁词", "国家级"],
    reason: "命中违禁或监管高压表述，发布前必须删除或改写。",
    suggestion: "合规表述",
  },
  {
    riskType: LEGAL_RISK_TYPES.sensitive,
    severity: LEGAL_RISK_SEVERITIES.medium,
    terms: ["无副作用", "永久"],
    reason: "命中敏感承诺，可能缺少可追溯证明材料。",
    suggestion: "体验感较好",
  },
  {
    riskType: LEGAL_RISK_TYPES.exaggeration,
    severity: LEGAL_RISK_SEVERITIES.high,
    terms: ["绝对第一", "最强", "全网第一", "马上见效"],
    reason: "命中绝对化或极限化宣传表达，可能构成夸大宣传。",
    suggestion: "表现出色",
  },
  {
    riskType: LEGAL_RISK_TYPES.copyright,
    severity: LEGAL_RISK_SEVERITIES.medium,
    terms: ["未经授权音乐", "明星同款"],
    reason: "涉及第三方素材、品牌或人物权益，需确认授权来源。",
    suggestion: "已授权素材",
  },
  {
    riskType: LEGAL_RISK_TYPES.fact,
    severity: LEGAL_RISK_SEVERITIES.high,
    terms: ["治愈", "根治", "100%有效"],
    reason: "命中功效或事实性强承诺，需要证据支撑。",
    suggestion: "改善",
  },
  {
    riskType: LEGAL_RISK_TYPES.platformRule,
    severity: LEGAL_RISK_SEVERITIES.medium,
    terms: ["抖音官方认证", "小红书官方推荐"],
    reason: "涉及平台背书或平台规则风险，需确认真实授权。",
    suggestion: "平台用户常见选择",
  },
];

export function scanLegalRiskFindings(content: string): LegalRiskFinding[] {
  const findings: LegalRiskFinding[] = [];

  for (const rule of MVP_LEGAL_RISK_RULES) {
    for (const term of rule.terms) {
      if (content.includes(term)) {
        findings.push({
          riskType: rule.riskType,
          severity: rule.severity,
          originalText: term,
          reason: rule.reason,
          suggestion: rule.suggestion,
        });
      }
    }
  }

  return findings;
}

export function buildLegalReviewSummary(findings: LegalRiskFinding[]): LegalReviewSummary {
  const counts = LEGAL_RISK_TYPE_ORDER.reduce(
    (result, riskType) => ({
      ...result,
      [riskType]: findings.filter((finding) => finding.riskType === riskType).length,
    }),
    {} as LegalReviewSummary["counts"]
  );
  const highRiskCount = findings.filter(
    (finding) => finding.severity === LEGAL_RISK_SEVERITIES.high
  ).length;

  return {
    requiresApproval: highRiskCount > 0,
    counts,
    highRiskCount,
    totalRiskCount: findings.length,
  };
}
