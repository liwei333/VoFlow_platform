import type { LegalRiskFinding } from "@/lib/legal-review/rules";
import type { LocalLlmServiceConfig } from "@/services/scriptLlmProvider";
import {
  getScriptAiModelRegistry,
  requireAvailableLlmService,
} from "@/services/scriptModelRegistryService";

export interface LegalReviewLlmInput {
  content: string;
  findings: LegalRiskFinding[];
}

export interface LegalReviewLlmReviewer {
  review(input: LegalReviewLlmInput): Promise<LegalRiskFinding[]>;
}

const defaultLegalReviewLlmReviewer: LegalReviewLlmReviewer = {
  async review(input) {
    const registry = await getScriptAiModelRegistry();
    const service = requireAvailableLlmService(registry.llm);
    return createLocalLegalReviewLlmReviewer({ service }).review(input);
  },
};

export interface CreateLocalLegalReviewLlmReviewerInput {
  service: LocalLlmServiceConfig;
  fetcher?: typeof fetch;
}

export function createLocalLegalReviewLlmReviewer(
  input: CreateLocalLegalReviewLlmReviewerInput
): LegalReviewLlmReviewer {
  const { service, fetcher = fetch } = input;
  const baseUrl = service.baseUrl.replace(/\/$/, "");

  return {
    async review(reviewInput) {
      const response = await fetcher(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: service.modelName,
          temperature: 0.2,
          messages: buildLegalReviewMessages(reviewInput),
        }),
      });

      if (!response.ok) {
        throw new Error(`Legal review LLM request failed: HTTP ${response.status}`);
      }

      const content = getChoiceContent(await response.json());
      return mergeLlmExplanations(reviewInput.findings, content);
    },
  };
}

export async function explainLegalRiskFindings(
  input: LegalReviewLlmInput,
  reviewer: LegalReviewLlmReviewer = defaultLegalReviewLlmReviewer
): Promise<LegalRiskFinding[]> {
  try {
    return await reviewer.review(input);
  } catch {
    return input.findings;
  }
}

function buildLegalReviewMessages(input: LegalReviewLlmInput) {
  return [
    {
      role: "system",
      content: "你是短视频发布前法务审查助手。只输出 JSON，不输出解释文本。",
    },
    {
      role: "user",
      content: JSON.stringify({
        outputFormat: {
          items: [
            {
              originalText: "命中的原句或词",
              reason: "风险原因",
              suggestion: "低风险替换建议",
            },
          ],
        },
        content: input.content,
        findings: input.findings,
      }),
    },
  ];
}

function getChoiceContent(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("Legal review LLM response is invalid");
  }

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) {
    throw new Error("Legal review LLM response missing choices");
  }

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== "object") {
    throw new Error("Legal review LLM response missing choice");
  }

  const message = (firstChoice as { message?: unknown }).message;
  if (!message || typeof message !== "object") {
    throw new Error("Legal review LLM response missing message");
  }

  const content = (message as { content?: unknown }).content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Legal review LLM response content is empty");
  }

  return content;
}

function mergeLlmExplanations(findings: LegalRiskFinding[], content: string): LegalRiskFinding[] {
  const parsed = JSON.parse(content) as { items?: unknown };
  if (!Array.isArray(parsed.items)) {
    throw new Error("Legal review LLM response missing items");
  }
  const items = parsed.items;

  return findings.map((finding) => {
    const explanation = items.find((item): item is Record<string, unknown> => {
      return Boolean(
        item &&
          typeof item === "object" &&
          (item as { originalText?: unknown }).originalText === finding.originalText
      );
    });

    if (!explanation) {
      return finding;
    }

    const reason = typeof explanation.reason === "string" ? explanation.reason.trim() : "";
    const suggestion = typeof explanation.suggestion === "string" ? explanation.suggestion.trim() : "";

    return {
      ...finding,
      reason: reason || finding.reason,
      suggestion: suggestion || finding.suggestion,
    };
  });
}
