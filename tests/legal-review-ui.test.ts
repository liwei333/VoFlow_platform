import { describe, expect, it } from "vitest";
import { getLegalRiskItemView, getLegalRiskTypeStats } from "@/lib/legal-review/ui";

describe("legal review UI helpers", () => {
  it("builds six legal risk statistic cells from summary counts", () => {
    expect(
      getLegalRiskTypeStats({
        counts: {
          exaggeration: 2,
          fact: 1,
        },
      })
    ).toEqual([
      { riskType: "forbidden", label: "违禁词", count: 0 },
      { riskType: "sensitive", label: "敏感词", count: 0 },
      { riskType: "exaggeration", label: "夸大宣传", count: 2 },
      { riskType: "copyright", label: "版权风险", count: 0 },
      { riskType: "fact", label: "事实风险", count: 1 },
      { riskType: "platform_rule", label: "平台规则", count: 0 },
    ]);
  });

  it("marks pending high-risk legal items as blocking", () => {
    expect(
      getLegalRiskItemView({
        riskType: "fact",
        severity: "high",
        action: "pending",
      })
    ).toMatchObject({
      riskTypeLabel: "事实风险",
      severityLabel: "高",
      actionLabel: "待处理",
      isBlocking: true,
    });

    expect(
      getLegalRiskItemView({
        riskType: "fact",
        severity: "high",
        action: "ignored",
      })
    ).toMatchObject({
      isBlocking: false,
    });
  });
});
