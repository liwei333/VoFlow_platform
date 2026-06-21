# Test Acceptance: voflow-script-ai

## Scope

本清单对应 `tasks.md` task 17，用来证明文案 AI / ASR / 标题 / 风险 / 本地模型保护的关键验收点已经落到自动化测试。测试保持复用统一本地模型注册表、health adapter 和状态 API，不在业务模块新增 LLM/ASR 地址、模型名、超时或状态文案配置。

## Acceptance Matrix

| 验收点 | 覆盖测试 | 证明内容 |
| --- | --- | --- |
| 文案为空校验 | `tests/script-save-api.test.ts` / `rejects empty script content` | `POST /api/projects/{projectId}/scripts` 对空白文案返回 `VALIDATION_ERROR`。 |
| 文案 3000 字上限 | `tests/script-save-api.test.ts` / `rejects script content over 3000 characters` | 3001 字文案被拒绝，不写入 `scripts`。 |
| ASR 超时长拒绝 | `tests/script-from-media-api.test.ts` / `rejects media longer than three minutes` | 超过 3 分钟音频返回 `ASR_DURATION_LIMIT_EXCEEDED`。 |
| ASR 任务输入 | `tests/script-from-media-api.test.ts` / `creates a queued ASR workflow node input for approved audio` | 已授权音频创建 `script_prepare` workflow node，input 包含素材、类型、地址和时长。 |
| ASR Worker 使用本地注册表 | `tests/script-asr-worker.test.ts` / `downloads media, reads ASR registry config, and returns transcript with segments` | Worker 只消费 registry 中 `asr.baseUrl`，输出文本和 segments，并保存转写。 |
| ASR 不可用节点失败且可重试 | `tests/script-ai-acceptance.test.ts` / `marks an ASR workflow node failed with a retryable local ASR error when ASR is unavailable` | ASR offline 时执行器将节点标记 `failed`，错误为 `LOCAL_ASR_UNAVAILABLE`，`script_prepare.retryable=true`。 |
| 本地 LLM mock 生成候选并保存 | `tests/script-rewrite-worker.test.ts` / `calls the local llm provider and saves rewrite candidates with prompt metadata` | mock 本地 LLM 返回 3 个候选，写入 `script_candidates`，保留 `modelName`、prompt 和 version。 |
| 标题候选生成并保存 | `tests/script-title-worker.test.ts` / `calls the local llm provider and saves title candidates for the script` | mock 本地 LLM 生成不少于 5 个标题并写入 `titleCandidates`。 |
| LLM 不可用节点失败且可重试 | `tests/script-ai-acceptance.test.ts` / `marks a rewrite workflow node failed with a retryable local LLM error when LLM is unavailable` | LLM offline 时执行器将节点标记 `failed`，错误为 `LOCAL_LLM_UNAVAILABLE`，`script_rewrite.retryable=true`。 |
| 默认不读取线上模型密钥 | `tests/script-model-registry-service.test.ts` / `does not read OpenAI or Claude keys when the provider defaults to local` | 默认 provider 为 `local-openai-compatible`，不会读取 OpenAI/Claude key getter。 |
| 外部 provider 显式开关 | `tests/script-model-registry-service.test.ts` / `rejects external llm providers unless explicitly enabled` 和 `allows external llm providers only when ALLOW_EXTERNAL_LLM is true` | 只有 `ALLOW_EXTERNAL_LLM=true` 时才允许非本地 provider。 |
| 敏感词命中风险报告 | `tests/script-risk-checker.test.ts` / `marks sensitive word hits as needs_review` | 风险 helper 输出 `script_risk` 报告，包含敏感词、版权提示和事实风险提示。 |
| 风险报告入库并等待审批 | `tests/script-risk-service.test.ts` / `writes risk_report_json and moves the node to waiting_approval when risk is hit` | 风险命中时写入 `script_candidates.riskReport`，workflow node 设置 `waiting_approval`。 |
| 风险命中必须显式确认 | `tests/script-candidate-approval-api.test.ts` 和 `tests/script-candidate-approval-service.test.ts` | risk report `requiresApproval=true` 时，未传 `confirmRisk=true` 不允许确认候选或绑定 video job。 |
| 文案/ASR UI 展示口径 | `tests/script-ui.test.ts` | 字数、预计时长、标题候选、风险摘要、媒体时长和 ASR segments 摘要使用公共 helper。 |

## Verification Commands

```bash
npm test -- --run tests/script-save-api.test.ts tests/script-from-media-api.test.ts tests/script-asr-worker.test.ts tests/script-asr-result-service.test.ts tests/script-rewrite-worker.test.ts tests/script-title-worker.test.ts tests/script-risk-checker.test.ts tests/script-risk-service.test.ts tests/script-model-registry-service.test.ts tests/script-candidate-approval-service.test.ts tests/script-candidate-approval-api.test.ts tests/script-ui.test.ts tests/script-ai-acceptance.test.ts
npx tsc --noEmit
npm run build
```
