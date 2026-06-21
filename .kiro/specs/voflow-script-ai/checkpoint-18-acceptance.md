# Checkpoint 18: 文案 AI 验收

验收日期：2026-06-20

## 本地依赖

- 对象存储：使用本机 `/opt/homebrew/bin/minio` 启动在 `localhost:9000`。
- Bucket：`voflow` 已创建。
- Docker 方式：`docker compose pull minio minio-init` 在镜像拉取阶段无进展，未作为本次验收依赖。

## 验收结论

| 验收点 | 证据 | 结论 |
| --- | --- | --- |
| 用户可以粘贴文案并生成 3-5 个候选 | `tests/script-save-api.test.ts`、`tests/script-rewrite-worker.test.ts` | 通过 |
| 用户可以上传短音视频并获得转写文本 | `tests/api.test.ts`、`tests/storage.test.ts`、`tests/script-from-media-api.test.ts`、`tests/script-asr-worker.test.ts`、`tests/script-asr-result-service.test.ts` | 通过 |
| 标题候选和风险报告可见 | `tests/script-title-worker.test.ts`、`tests/script-risk-checker.test.ts`、`tests/script-risk-service.test.ts`、`tests/script-ui.test.ts` | 通过 |
| 默认通过本地大模型完成文案和标题生成 | `tests/script-model-registry-service.test.ts`、`tests/script-rewrite-worker.test.ts`、`tests/script-title-worker.test.ts` | 通过 |
| 断开本地 LLM 时文案节点失败并允许重试 | `tests/script-ai-acceptance.test.ts` | 通过 |

## 验收命令

```bash
npm test -- --run tests/storage.test.ts tests/api.test.ts
npm test -- --run tests/script-save-api.test.ts tests/script-from-media-api.test.ts tests/script-asr-worker.test.ts tests/script-asr-result-service.test.ts tests/script-rewrite-worker.test.ts tests/script-title-worker.test.ts tests/script-risk-checker.test.ts tests/script-risk-service.test.ts tests/script-model-registry-service.test.ts tests/script-candidate-approval-service.test.ts tests/script-candidate-approval-api.test.ts tests/script-ui.test.ts tests/script-list-api.test.ts tests/script-ai-acceptance.test.ts
npm test
npm run build
npx tsc --noEmit
```

## 结果摘要

- `tests/storage.test.ts tests/api.test.ts`：2 个文件、53 条用例通过。
- 文案 AI 验收组：14 个文件、48 条用例通过。
- 全量 `npm test`：41 个文件、246 条用例通过。
- `npm run build`：Next.js 生产构建通过。
- `npx tsc --noEmit`：类型检查通过。

## 复验记录

2026-06-20 18:43:26 CST 复验通过：

- MinIO：`localhost:9000` 正在监听，bucket `voflow` 存在。
- `tests/storage.test.ts tests/api.test.ts`：2 个文件、53 条用例通过。
- 文案 AI 验收组：14 个文件、48 条用例通过。
- 全量 `npm test`：41 个文件、246 条用例通过。
- `npx tsc --noEmit`：类型检查通过。
- `npm run build`：Next.js 生产构建通过。
