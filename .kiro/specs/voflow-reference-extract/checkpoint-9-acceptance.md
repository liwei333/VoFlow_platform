# Checkpoint 9: 爆款提取验收

日期：2026-06-21

## 验收范围

- 独立 `/dashboard/hot-content` 页面替换占位页。
- 支持爆款链接解析、直接上传视频/音频、从已授权素材提取三条入口。
- 参考来源列表展示来源、状态、时长、转写文本、结构分析结果和失败兜底。
- `文案库` 页面复用同一个参考来源行组件，避免展示逻辑重复。

## 硬编码检查

- 未新增服务地址、密钥、模型名、错误码、MIME 白名单或对象存储路径硬编码。
- 链接平台识别、状态文案、失败兜底文案继续复用 `src/lib/references/ui.ts` 和 `src/lib/references/platforms.ts`。
- 上传后授权用途收口为 `REFERENCE_UPLOAD_USAGE_SCOPE`，页面不散写授权用途。

## 公共函数和组件

- 新增 `src/components/references/ReferenceSourceRow.tsx` 复用参考来源展示。
- 新增 `src/components/references/types.ts` 复用页面展示类型。
- `src/app/dashboard/scripts/page.tsx` 已改为复用共享 `ReferenceSourceRow`。

## 验证命令

```bash
npm run test:run -- tests/reference-components.test.tsx
npm run test:run -- tests/reference-ui.test.ts tests/reference-components.test.tsx tests/reference-api.test.ts tests/reference-asset-extraction-service.test.ts tests/reference-asr-service.test.ts tests/reference-structure-worker.test.ts
npm run test:run -- --exclude tests/api.test.ts
API_BASE=http://localhost:3000 npm run test:run -- tests/api.test.ts
API_BASE=http://localhost:3000 npm run test:run
npm run lint
npm run build
```

浏览器验收：

- 使用系统 Chrome 登录 `dev@voflow.local` 后访问 `http://localhost:3000/dashboard/hot-content`。
- 页面包含“爆款提取”“从链接解析”“上传视频/音频”“从素材提取”“参考来源”。
- 页面不包含“该功能正在开发中”。

## 验收标准

- 用户可以在 `/dashboard/hot-content` 提交链接或上传文件。
- 系统可以展示平台、时长、原始转写文本和结构分析结果。
- 链接或提取失败时展示上传兜底路径，并保留失败重试入口。
- 相关 reference 测试和 lint 均通过。
