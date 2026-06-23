# Tasks: voflow-reference-url-import

## Implementation Plan

- [x] 0. 执行后续开发规范检查
  - 先阅读 `docs/03-VoFlow开发执行规范.md`
  - 不得在页面、API 或 Worker 中散写 yt-dlp binary、平台白名单、错误码、状态文案、时长限制、大小限制或下载开关
  - 新增配置必须收口到配置模块和 `.env.example`
  - 新增 API 必须复用统一鉴权、统一响应、Zod 校验和 serializer
  - Checkpoint 反馈必须包含硬编码检查、公共函数提取情况和验证命令
  - _Requirements: US-1, US-2, US-3, US-4, NFR-1, NFR-2, NFR-3, NFR-4_

- [x] 1. 定义参考链接导入配置和常量
  - 新增 `VOFLOW_REFERENCE_LINK_IMPORT_ENABLED`、`VOFLOW_YTDLP_BIN`、timeout、metadata/subtitle/audio 大小限制、最大时长、平台白名单和完整视频下载开关
  - 默认禁用真实链接导入，默认禁用完整视频下载
  - 将 `reference_analysis_only` 收口为授权用途常量
  - _Requirements: US-1.5, US-3.5, US-4.2, NFR-3_

- [x] 2. 扩展参考来源数据模型
  - 为 `ReferenceSource` 增加 title、thumbnailUrl、metadataJson、subtitleJson、importMode、consentStatus、consentConfirmedAt、consentConfirmedBy
  - 新增迁移和 serializer 输出
  - 确保 metadata 不写入 structureJson
  - _Requirements: US-1.1, US-1.2, US-4.1_

- [x] 3. 实现 `YtDlpClient`
  - 使用 `spawn(ytdlpBin, args)` 调用 binary，不使用 shell 字符串拼接
  - 支持 metadata、subtitle、audio extract 和 version 查询的接口抽象
  - 实现 timeout、stdout/stderr 限制、错误归一化和临时目录清理
  - 单元测试使用 mock process 或 fake client，不访问外网
  - _Requirements: US-1.2, US-1.4, NFR-1, NFR-2, NFR-4_

- [x] 4. 实现 metadata normalize 和 `ReferenceLinkParser` 接入
  - 新增 `ytDlpParser` 实现现有 `ReferenceLinkParser`
  - 规范化 title、durationMs、thumbnailUrl、extractor、subtitles、automaticCaptions 和 bounded raw summary
  - 平台不在白名单时返回 unsupported fallback
  - _Requirements: US-1.1, US-1.2, US-1.3, US-1.4_

- [x] 5. 实现 URL metadata parse API
  - 新增 `POST /api/projects/{projectId}/references/url/parse`
  - 校验项目和 team 权限
  - 创建或更新 `ReferenceSource(status=metadata_ready)`
  - 只解析 metadata，不下载字幕、音频或视频
  - _Requirements: US-1.1, US-1.2, US-1.3, US-1.5_

- [x] 6. 实现参考链接授权确认和导入 API
  - 新增 `POST /api/projects/{projectId}/references/{referenceSourceId}/import`
  - 支持 `metadata_only`、`subtitle_only`、`audio_extract`
  - 要求 `subtitle_only` 和 `audio_extract` 提交 reference-analysis-only consent
  - 保存 consentTextVersion、importMode、userId、teamId 和 confirmedAt
  - _Requirements: US-2.2, US-3.1, US-3.2, US-4.1_

- [x] 7. 实现 `reference_url_import` workflow node
  - 新增节点类型、输入 serializer 和 Worker handler
  - API route 只入队，不在请求内执行 yt-dlp 下载
  - 任务详情能展示 importing/transcribing/structuring/succeeded/failed 状态
  - _Requirements: US-2.2, US-2.3, US-3.4, NFR-2_

- [x] 8. 实现字幕优先导入
  - 选择人工字幕优先，其次自动字幕
  - 下载并解析 VTT/SRT 字幕，生成清洗文本和有序 `AsrSegment`
  - 创建 `Script(sourceType=asr)` 并绑定 `ReferenceSource.transcriptScriptId`
  - 复用参考结构分析能力生成 structureJson
  - _Requirements: US-2.1, US-2.2, US-2.3, US-2.4_

- [ ] 9. 实现授权后音频提取
  - 无字幕或用户选择音频路径时，校验 consent、时长、大小、平台和开关
  - 仅提取音频并上传 MinIO
  - 创建 `Asset(type=audio)` 和 `AssetConsent(usageScope=reference_analysis_only)`
  - 复用现有 `reference_extract` 创建 ASR 和结构分析任务
  - _Requirements: US-3.1, US-3.2, US-3.3, US-3.4, US-3.5_

- [ ] 10. 实现合规阻断和审计日志
  - 成功和失败导入均写 `AuditLog`
  - 阻断完整视频下载、cookie/登录态导入、去水印、批量频道采集
  - 阻断公开链接导入素材用于 voice clone、avatar、publish 或 generation scope
  - _Requirements: US-4.2, US-4.3, US-4.4, US-4.5_

- [ ] 11. 实现 UI 状态和用户确认
  - 在爆款提取 UI 展示 metadata、字幕可用性、推荐 importMode 和失败 fallback
  - 导入前展示 reference-analysis-only 授权确认
  - 明确文案：参考分析，不是下载器，不提供完整视频下载或去水印
  - _Requirements: US-1.1, US-2.1, US-3.1, US-4.1, US-4.5_

- [ ] 12. 添加测试
  - 单元测试：metadata normalize、字幕选择、字幕解析、duration/size limit、unsupported fallback、command args 安全
  - Service 测试：metadata parse、confirm import、subtitle creates Script/AsrSegment、audio creates Asset/Consent/WorkflowNode、failed import writes AuditLog
  - Worker 测试：mock `YtDlpClient` 覆盖 metadata_only、subtitle_only、audio_extract
  - API 测试：team isolation、feature disabled、consent required、unsupported platform
  - _Requirements: US-1, US-2, US-3, US-4, NFR-4_

- [ ] 13. 更新本地运行文档
  - 在 `docs/04-本地运行项目教程.md` 写明本地安装 `yt-dlp` 和 `ffmpeg` 的可选步骤
  - 说明 Docker/Homebrew 模式下的配置项和默认禁用策略
  - 说明国内平台仅平台识别和 fallback，不承诺自动提取
  - _Requirements: US-1.3, US-1.5, US-4.5, NFR-3_

- [ ] 14. Checkpoint: 参考链接真实导入验收
  - 用户粘贴白名单公开链接后可看到 metadata
  - 有字幕链接可生成 `Script`、`AsrSegment` 和 structureJson
  - 无字幕链接在授权后可提取音频并复用 `reference_extract`
  - 未授权、超时、超长、平台不支持、完整视频下载请求均返回明确 fallback
  - 审计日志包含 sourceUrl、platform、importMode、consentTextVersion、ytDlpVersion 和失败原因
  - 验收命令包含 focused tests、lint 和必要的 build
  - _Requirements: US-1, US-2, US-3, US-4, NFR-1, NFR-2, NFR-3, NFR-4_

## 执行反馈

### Task 0-5: metadata-only 链路

### 任务
- Spec: `voflow-reference-url-import`
- Task: 0、1、2、3、4、5
- Requirements: US-1.1、US-1.2、US-1.3、US-1.4、US-1.5、NFR-1、NFR-2、NFR-3、NFR-4

### 修改文件
- `.env.example`
- `prisma/schema.prisma`
- `prisma/migrations/20260622152000_add_reference_url_import_metadata/migration.sql`
- `src/app/api/projects/[projectId]/references/url/parse/route.ts`
- `src/lib/references/serializer.ts`
- `src/lib/references/ui.ts`
- `src/components/references/types.ts`
- `src/lib/references/url-import/config.ts`
- `src/lib/references/url-import/metadata.ts`
- `src/lib/references/url-import/parser.ts`
- `src/lib/references/url-import/ytdlp-client.ts`
- `src/services/referenceUrlImportService.ts`
- `tests/reference-api.test.ts`
- `tests/reference-source-schema.test.ts`
- `tests/reference-url-import-config.test.ts`
- `tests/reference-url-import-parser.test.ts`

### 范围说明
- 本次完成：真实参考链接导入配置收口、ReferenceSource metadata 字段扩展、`YtDlpClient` metadata 查询、metadata normalize、`ReferenceLinkParser` 接入、`POST /api/projects/{projectId}/references/url/parse` metadata-only API。
- 明确未完成：授权确认 API、`reference_url_import` workflow node、字幕下载/解析、授权后音频提取、审计日志、UI 状态和用户确认。
- 是否使用 mock/provider/adapter 占位：测试使用 mock `ReferenceLinkParser`/fake spawn，不访问外网；运行时代码默认调用本机 `yt-dlp`，但 feature flag 默认关闭。

### 硬编码检查
- 是否新增运行时硬编码：未新增散落硬编码；错误码、配置默认值、授权用途常量收口在 `src/lib/references/url-import/config.ts`。
- 新增配置是否收口：已收口到 `buildReferenceLinkImportConfig()` 和 `.env.example`。
- 新增错误码/状态/枚举是否收口：错误码收口到配置模块；`metadata_ready`、`ReferenceImportMode`、`ReferenceConsentStatus` 收口到 Prisma schema/migration；前端状态 label 收口到 `src/lib/references/ui.ts`。

### 公共化检查
- 复用的公共模块：`requireAuth`、`api-response`、`parseReferenceLink`、`detectReferencePlatform`、`serializeReferenceSource`、Prisma service 层。
- 新增的公共函数/service：`buildReferenceLinkImportConfig`、`normalizeYtDlpMetadata`、`YtDlpClient`、`createYtDlpReferenceLinkParser`、`parseReferenceUrlMetadata`。
- 后续需要抽取的重复逻辑：Task 6-10 做导入/审计时，需要继续复用当前 config/error/fallback 常量，避免在 worker 和 UI 中重复平台/状态/错误码。

### 验证命令
- `npx prisma generate`: 通过。
- `npx prisma migrate deploy`: 通过，已应用 `20260622152000_add_reference_url_import_metadata`。
- `npm run test:run -- tests/reference-url-import-config.test.ts tests/reference-url-import-parser.test.ts tests/reference-source-schema.test.ts tests/reference-api.test.ts`: 通过，4 files / 25 tests。
- `npm run lint`: 通过。
- `npm run build`: 通过。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 0-5。
- 是否满足对应 Acceptance Criteria：满足 US-1 metadata 解析的 metadata-only 基础链路；US-2/US-3/US-4 仍待后续任务完成。
- 是否允许勾选：允许勾选 Task 0-5，不允许勾选 Task 6-14 或 Checkpoint 14。
- MVP 状态矩阵是否需要同步更新：需要，`voflow-reference-url-import` 从 `not_started` 更新为 metadata-only `partial`。

### Task 6: 参考链接授权确认和导入 API

### 任务
- Spec: `voflow-reference-url-import`
- Task: 6
- Requirements: US-2.2、US-3.1、US-3.2、US-4.1

### 修改文件
- `src/app/api/projects/[projectId]/references/[referenceSourceId]/import/route.ts`
- `src/services/referenceUrlImportService.ts`
- `src/lib/references/url-import/config.ts`
- `src/app/api/projects/[projectId]/references/url/parse/route.ts`
- `tests/reference-api.test.ts`

### 范围说明
- 本次完成：`POST /api/projects/{projectId}/references/{referenceSourceId}/import`，支持 `metadata_only`、`subtitle_only`、`audio_extract` 三种导入模式；`subtitle_only` 和 `audio_extract` 要求提交 reference-analysis-only consent；保存 `importMode`、`consentTextVersion`、`userId`、`teamId`、`confirmedAt` 到 `metadataJson.importConsent`，并写入 `consentStatus/consentConfirmedAt/consentConfirmedBy`。
- `metadata_only` 确认后将 `ReferenceSource.status` 置为 `succeeded`，不创建 worker 节点。
- `subtitle_only` 确认后将 `ReferenceSource.status` 置为 `pending`，返回 `nextStep.nodeType=reference_url_import`，但不在 API 请求内下载字幕或执行结构分析。
- `audio_extract` 受 `VOFLOW_REFERENCE_ALLOW_AUDIO_EXTRACT` 控制；默认禁用时返回明确错误。
- 明确未完成：`reference_url_import` workflow node、字幕下载/解析、授权后音频提取、审计日志、UI 授权确认。

### 硬编码检查
- 是否新增运行时硬编码：未新增散落硬编码；新增错误码和文案收口在 `src/lib/references/url-import/config.ts`。
- 新增 API 是否复用公共能力：已复用 `requireAuth`、`api-response`、Zod 校验和 `serializeReferenceSource`。
- 是否在 route 内执行下载：否，API 只保存确认状态和返回下一步节点信息。

### 公共化检查
- 新增 service：`confirmReferenceUrlImport`。
- 类型收口：metadata parse 和 import confirm 拆分为各自错误码类型，避免 route 互相承担不属于自己的错误分支。
- 后续需要复用：Task 7-10 必须复用 `importConsent`、`reference_url_import` nextStep 和配置错误码，避免在 Worker/UI 中重复定义导入模式和授权状态。

### 验证命令
- `npm run test:run -- tests/reference-url-import-config.test.ts tests/reference-url-import-parser.test.ts tests/reference-source-schema.test.ts tests/reference-api.test.ts`: 通过，4 files / 30 tests。
- `npm run lint`: 通过。
- `npm run build`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 6。
- 是否满足对应 Acceptance Criteria：满足授权确认、导入模式保存、team 隔离、字幕/音频 consent 校验和默认禁用音频提取；真正的 worker 执行链路仍待 Task 7-9。
- 是否允许勾选：允许勾选 Task 6，不允许勾选 Task 7-14 或 Checkpoint 14。
- 下一步：Task 7，实现 `reference_url_import` workflow node，使 `subtitle_only`/`audio_extract` 的 pending 状态进入异步执行链路。

### Task 7: `reference_url_import` workflow node

### 任务
- Spec: `voflow-reference-url-import`
- Task: 7
- Requirements: US-2.2、US-2.3、US-3.4、NFR-2

### 修改文件
- `src/lib/workflow/constants.ts`
- `src/services/referenceUrlImportService.ts`
- `src/services/referenceUrlImportWorkerService.ts`
- `src/services/workflowWorkerService.ts`
- `src/app/api/projects/[projectId]/references/[referenceSourceId]/import/route.ts`
- `src/lib/references/url-import/config.ts`
- `tests/reference-api.test.ts`
- `tests/workflow-worker-artifact-service.test.ts`

### 范围说明
- 本次完成：新增 `reference_url_import` workflow node 类型，并注册默认 Worker handler。
- `subtitle_only` / `audio_extract` 授权确认后，API 会创建 `VideoJob(status=queued,currentNode=reference_url_import)` 和 `WorkflowNode(nodeType=reference_url_import,status=queued,input=ReferenceUrlImportWorkflowInput)`，并投递队列。
- `metadata_only` 仍不创建 workflow job，确认后直接完成。
- Worker handler 目前只校验输入并输出 `stage=importing` 与 mode-specific deferred status，确保节点能被任务详情展示和执行框架识别；字幕下载/解析和音频提取本体仍保留给 Task 8/9。

### 硬编码检查
- 是否新增运行时硬编码：节点类型收口到 `src/lib/workflow/constants.ts`；入队失败错误码和文案收口到 `src/lib/references/url-import/config.ts`。
- API route 是否执行 yt-dlp 下载：否，route 只保存确认、创建 job/node、投递队列。
- 默认完整视频工作流是否被污染：否，`reference_url_import` 是可用节点类型，但没有加入 `DEFAULT_WORKFLOW_TEMPLATE`。

### 公共化检查
- 复用的公共模块：`workflowQueue`、`createWorkflowTraceId`、`VideoJob`/`WorkflowNode` 单节点任务模式、`createDefaultWorkflowNodeHandlers`。
- 新增公共函数/service：`createReferenceUrlImportWorkflowNodeHandler`。
- 后续需要复用：Task 8 应在该 handler 或其下游 service 内实现字幕优先导入；Task 9 应复用同一 workflow input 实现授权后音频提取。

### 验证命令
- RED: `npm run test:run -- tests/reference-api.test.ts` 先失败，原因是 import API 仍返回 `nextStep.status=pending` 且未创建 job/node。
- RED: `npm run test:run -- tests/workflow-worker-artifact-service.test.ts` 先失败，原因是默认 handlers 未注册 `reference_url_import`，执行落到 mock handler。
- GREEN: `npm run test:run -- tests/reference-url-import-config.test.ts tests/reference-url-import-parser.test.ts tests/reference-source-schema.test.ts tests/reference-api.test.ts tests/workflow-worker-artifact-service.test.ts tests/workflow-progress-service.test.ts tests/workflow-job-detail-api.test.ts`: 通过，7 files / 46 tests。
- `npm run lint`: 通过。
- `npm run build`: 通过。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 7。
- 是否满足对应 Acceptance Criteria：满足新增节点类型、输入 serializer/worker handler、API route 只入队不执行下载、任务详情可识别 queued/running/succeeded/failed 节点状态；`importing/transcribing/structuring` 的细分执行阶段将在 Task 8/9 随字幕/音频实际处理补齐。
- 是否允许勾选：允许勾选 Task 7，不允许勾选 Task 8-14 或 Checkpoint 14。
- 下一步：Task 8，实现字幕优先导入，下载并解析 VTT/SRT，创建 `Script`、`AsrSegment` 并复用参考结构分析。

### Task 8: 字幕优先导入

### 任务
- Spec: `voflow-reference-url-import`
- Task: 8
- Requirements: US-2.1、US-2.2、US-2.3、US-2.4

### 修改文件
- `src/lib/references/url-import/config.ts`
- `src/lib/references/url-import/subtitle.ts`
- `src/services/referenceUrlImportWorkerService.ts`
- `tests/reference-url-import-subtitle.test.ts`
- `tests/reference-url-import-worker.test.ts`
- `tests/workflow-worker-artifact-service.test.ts`

### 范围说明
- 本次完成：字幕轨选择、VTT/SRT 字幕解析、字幕下载器接口、`reference_url_import` worker 的 `subtitle_only` 实际执行链路。
- 字幕轨选择规则：优先人工字幕 `subtitles`，再用 `automaticCaptions`；语言优先级为中文相关轨道，其次英文，再保留其他可用轨道。
- 字幕导入成功后创建 `Script(sourceType=asr,status=ready)`，写入清洗后的字幕文本，并创建有序 `AsrSegment`。
- `ReferenceSource.transcriptScriptId` 绑定字幕脚本，`ReferenceSource.structureJson` 写入结构分析结果和 provider/modelName，状态置为 `succeeded`。
- 结构分析复用现有 `ReferenceStructureProvider` 接口；测试中使用 fake provider，不访问本地 LLM。
- `audio_extract` 仍保持 deferred，留给 Task 9。

### 硬编码检查
- 是否新增运行时硬编码：新增字幕错误码和文案收口在 `src/lib/references/url-import/config.ts`；字幕轨/解析逻辑收口在 `src/lib/references/url-import/subtitle.ts`。
- 是否访问外网测试：否，worker 测试使用 fake subtitle downloader 和 fake structure provider。
- 是否在 API route 执行下载：否，下载和结构分析均在 worker handler 内执行。

### 公共化检查
- 新增公共工具：`selectPreferredSubtitleTrack`、`parseSubtitleText`。
- 新增 worker 依赖接口：`ReferenceSubtitleDownloader`、可注入 `ReferenceStructureProvider`。
- 复用的公共模块：`createLocalReferenceStructureProvider`、`getScriptAiModelRegistry`、`requireAvailableLlmService`、Prisma `Script`/`AsrSegment`/`ReferenceSource` 关系。

### 验证命令
- RED: `npm run test:run -- tests/reference-url-import-subtitle.test.ts` 先失败，原因是 `src/lib/references/url-import/subtitle.ts` 不存在。
- RED: `npm run test:run -- tests/reference-url-import-worker.test.ts` 先失败，原因是 worker 仍返回 `deferred_to_subtitle_import_task`，未创建 `Script`/`AsrSegment`/`structureJson`。
- GREEN: `npm run test:run -- tests/reference-url-import-subtitle.test.ts tests/reference-url-import-worker.test.ts tests/workflow-worker-artifact-service.test.ts tests/reference-api.test.ts tests/reference-url-import-config.test.ts tests/reference-url-import-parser.test.ts tests/reference-source-schema.test.ts`: 通过，7 files / 42 tests。
- `npm run lint`: 通过。
- `npm run build`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 8。
- 是否满足对应 Acceptance Criteria：满足字幕优先选择、下载/解析、`Script`/`AsrSegment` 创建、绑定 `ReferenceSource.transcriptScriptId` 和复用结构分析生成 `structureJson`。
- 是否允许勾选：允许勾选 Task 8，不允许勾选 Task 9-14 或 Checkpoint 14。
- 下一步：Task 9，实现授权后音频提取，创建 `Asset(type=audio)` 和 `AssetConsent(reference_analysis_only)`，并复用现有 `reference_extract` ASR/结构分析链路。
