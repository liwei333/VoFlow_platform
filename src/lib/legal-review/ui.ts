import {
  LEGAL_RISK_ACTION_LABELS,
  LEGAL_RISK_SEVERITY_LABELS,
  LEGAL_RISK_TYPE_LABELS,
  LEGAL_RISK_TYPE_ORDER,
} from "@/lib/legal-review/constants";

export interface LegalReviewSummaryLike {
  counts?: Partial<Record<string, number>>;
}

export interface LegalRiskItemLike {
  riskType: string;
  severity: string;
  action: string;
}

export function getLegalRiskTypeStats(summary: LegalReviewSummaryLike | null | undefined) {
  return LEGAL_RISK_TYPE_ORDER.map((riskType) => ({
    riskType,
    label: LEGAL_RISK_TYPE_LABELS[riskType],
    count: summary?.counts?.[riskType] ?? 0,
  }));
}

export function getLegalRiskItemView(item: LegalRiskItemLike) {
  return {
    riskTypeLabel: LEGAL_RISK_TYPE_LABELS[item.riskType] ?? item.riskType,
    severityLabel: LEGAL_RISK_SEVERITY_LABELS[item.severity] ?? item.severity,
    actionLabel: LEGAL_RISK_ACTION_LABELS[item.action] ?? item.action,
    isBlocking: item.severity === "high" && item.action === "pending",
  };
}
