# Tasks: voflow-reference-url-import

## Implementation Plan

- [x] 0. 执行后续开发规范检查
  - 先阅读 `AI_RULES.md`
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

- [x] 9. 实现授权后音频提取
  - 无字幕或用户选择音频路径时，校验 consent、时长、大小、平台和开关
  - 仅提取音频并上传 MinIO
  - 创建 `Asset(type=audio)` 和 `AssetConsent(usageScope=reference_analysis_only)`
  - 复用现有 `reference_extract` 创建 ASR 和结构分析任务
  - _Requirements: US-3.1, US-3.2, US-3.3, US-3.4, US-3.5_

- [x] 10. 实现合规阻断和审计日志
  - 成功和失败导入均写 `AuditLog`
  - 阻断完整视频下载、cookie/登录态导入、去水印、批量频道采集
  - 阻断公开链接导入素材用于 voice clone、avatar、publish 或 generation scope
  - _Requirements: US-4.2, US-4.3, US-4.4, US-4.5_

- [x] 11. 实现 UI 状态和用户确认
  - 在爆款提取 UI 展示 metadata、字幕可用性、推荐 importMode 和失败 fallback
  - 导入前展示 reference-analysis-only 授权确认
  - 明确文案：参考分析，不是下载器，不提供完整视频下载或去水印
  - _Requirements: US-1.1, US-2.1, US-3.1, US-4.1, US-4.5_

- [x] 12. 添加测试
  - 单元测试：metadata normalize、字幕选择、字幕解析、duration/size limit、unsupported fallback、command args 安全
  - Service 测试：metadata parse、confirm import、subtitle creates Script/AsrSegment、audio creates Asset/Consent/WorkflowNode、failed import writes AuditLog
  - Worker 测试：mock `YtDlpClient` 覆盖 metadata_only、subtitle_only、audio_extract
  - API 测试：team isolation、feature disabled、consent required、unsupported platform
  - _Requirements: US-1, US-2, US-3, US-4, NFR-4_

- [x] 13. 更新本地运行文档
  - 在 `docs/04-本地运行项目教程.md` 写明本地安装 `yt-dlp` 和 `ffmpeg` 的可选步骤
  - 说明 Docker/Homebrew 模式下的配置项和默认禁用策略
  - 说明国内平台仅平台识别和 fallback，不承诺自动提取
  - _Requirements: US-1.3, US-1.5, US-4.5, NFR-3_

- [x] 14. Checkpoint: 参考链接真实导入验收
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

### Task 9: 授权后音频提取

### 任务
- Spec: `voflow-reference-url-import`
- Task: 9
- Requirements: US-3.1、US-3.2、US-3.3、US-3.4、US-3.5

### 修改文件
- `src/lib/assets/consent.ts`
- `src/lib/references/url-import/config.ts`
- `src/lib/references/url-import/ytdlp-client.ts`
- `src/services/referenceAssetService.ts`
- `src/services/referenceAsrService.ts`
- `src/services/referenceUrlImportWorkerService.ts`
- `tests/reference-asset-extraction-service.test.ts`
- `tests/reference-url-import-worker.test.ts`
- `tests/workflow-worker-artifact-service.test.ts`

### 范围说明
- 本次完成：`reference_url_import` worker 的 `audio_extract` 实际执行链路。
- Worker 会复核总开关、音频提取开关、平台白名单、授权状态、sourceUrl、时长限制和提取后音频大小限制。
- 默认 yt-dlp 音频提取使用 `spawn` 参数数组和临时目录，执行 `--no-playlist --extract-audio --audio-format m4a`，不创建完整视频素材，并在 finally 中清理临时目录。
- 提取成功后上传 MinIO，创建 `Asset(type=audio,licenseStatus=approved)` 和 `AssetConsent(usageScope=["reference_analysis_only"])`。
- `reference_extract` 入口新增可选 `usageScope`，URL 音频路径显式传 `reference_analysis_only`；普通上传素材路径默认仍使用 `video_generation`。
- `ReferenceSource(status=transcribing)` 绑定提取出的音频 `assetId`，并在 `metadataJson.audioExtract` 记录 asset、storageUrl、size、reference_extract job/node/source 衔接信息。

### 硬编码检查
- 是否新增运行时硬编码：新增错误码和限制文案收口在 `src/lib/references/url-import/config.ts`；`reference_analysis_only` 使用配置模块常量。
- 是否 shell 拼接命令：否，yt-dlp 仍通过 `spawn(ytdlpBin,args,{shell:false})` 调用。
- 是否下载完整视频：否，Task 9 默认客户端只做音频后处理输出；完整视频下载仍未实现。
- 是否在 API route 执行下载：否，下载、上传和 reference_extract 入队均在 worker 内执行。

### 公共化检查
- 复用的公共模块：`uploadAsset`、`createReferenceExtractTask`、`prepareReferenceAssetExtraction`、`assertAssetUsable`、workflow queue。
- 新增 worker 依赖接口：`ReferenceAudioExtractor`、`ReferenceAudioAssetStorage`、`ReferenceExtractTaskCreator`，测试可注入 fake，不访问外网或 MinIO。
- 底层授权 scope 扩展为允许 `reference_analysis_only`，但通用资产 UI 默认选项未扩展，避免把参考链接专用 scope 暴露给上传素材生成路径。

### 验证命令
- RED: `npm run test:run -- tests/reference-asset-extraction-service.test.ts tests/reference-url-import-worker.test.ts` 先失败，原因是 `reference_analysis_only` 授权不被 `reference_extract` 接受，且 `audio_extract` 仍返回 deferred。
- RED: `npm run test:run -- tests/reference-url-import-worker.test.ts` 先失败，原因是 worker 未复核 `VOFLOW_REFERENCE_LINK_IMPORT_ENABLED`。
- GREEN: `npm run test:run -- tests/reference-asset-extraction-service.test.ts tests/reference-url-import-worker.test.ts`: 通过，2 files / 8 tests。
- 回归: `npm run test:run -- tests/reference-url-import-subtitle.test.ts tests/reference-url-import-worker.test.ts tests/workflow-worker-artifact-service.test.ts tests/reference-api.test.ts tests/reference-url-import-config.test.ts tests/reference-url-import-parser.test.ts tests/reference-source-schema.test.ts tests/reference-asset-extraction-service.test.ts tests/reference-asr-service.test.ts tests/asset-consent.test.ts`: 通过，10 files / 58 tests。
- `npm run lint`: 通过。
- `npm run build`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 9。
- 是否满足对应 Acceptance Criteria：满足授权后仅提取音频、创建 `Asset(type=audio)` / `AssetConsent(reference_analysis_only)`、校验开关/平台/时长/大小，并复用现有 `reference_extract` ASR/结构分析链路。
- 是否允许勾选：允许勾选 Task 9，不允许勾选 Task 10-14 或 Checkpoint 14。
- 下一步：Task 10，实现合规阻断和审计日志，补齐成功/失败导入审计、完整视频/cookie/去水印/批量采集阻断，以及公开链接导入素材被用于 voice clone/avatar/publish/generation scope 的阻断。

### Task 10: 合规阻断和审计日志

### 任务
- Spec: `voflow-reference-url-import`
- Task: 10
- Requirements: US-4.2、US-4.3、US-4.4、US-4.5

### 修改文件
- `prisma/schema.prisma`
- `prisma/migrations/20260623093000_add_reference_url_import_audit_action/migration.sql`
- `src/app/api/projects/[projectId]/references/from-asset/route.ts`
- `src/app/api/projects/[projectId]/references/url/parse/route.ts`
- `src/lib/assets/consent.ts`
- `src/lib/references/url-import/config.ts`
- `src/services/referenceAssetService.ts`
- `src/services/referenceUrlImportService.ts`
- `src/services/referenceUrlImportWorkerService.ts`
- `tests/asset-consent.test.ts`
- `tests/reference-api.test.ts`
- `tests/reference-url-import-worker.test.ts`

### 范围说明
- 本次完成：新增 `AuditAction.reference_url_import`，并用 migration 更新数据库 enum。
- `reference_url_import` worker 在字幕成功、音频导入成功、导入失败时写 `AuditLog(action=reference_url_import,targetType=reference_source)`。
- 审计 metadata 包含 `status`、`importMode`、`consentTextVersion`、`sourceUrl`、`platform`、`durationMs`、`ytDlpVersion` 和 `failureReason`。
- URL parse API 新增可选 `requestedCapability`，阻断 `full_video`、`cookie_import`、`no_watermark`、`batch_channel`，并对 YouTube playlist/channel 等批量链接做前置阻断。
- 阻断请求写 `AuditLog(action=reference_url_import,targetType=reference_url,status=blocked)`，不进入 yt-dlp metadata 解析。
- `assertAssetUsable` 识别 `metadata.sourceType=reference_url_import` 的素材；当业务请求 `video_generation`、`avatar_generation`、`publishing` 等非 `reference_analysis_only` 用途时，返回 `ASSET_USAGE_SCOPE_NOT_ALLOWED`。
- `reference_extract` 通过 Task 9 显式传 `reference_analysis_only`，因此公开链接音频仍可用于内部参考分析，但不能被生成/数字人/发布类 scope 复用。

### 硬编码检查
- 是否新增运行时硬编码：禁止请求错误码/文案收口到 `src/lib/references/url-import/config.ts`；新增 audit action 收口到 Prisma enum/migration。
- 是否在 API route 调用 yt-dlp：否，API route 只做 schema、鉴权和 service 调用；禁止能力在 service 层阻断。
- 是否允许完整视频/cookie/去水印/批量采集：否，相关 `requestedCapability` 和批量 URL 在 metadata parse 前返回 `REFERENCE_URL_IMPORT_PROHIBITED_REQUEST`。

### 公共化检查
- 复用的公共模块：`writeAuditLog`、`assertAssetUsable`、`REFERENCE_ANALYSIS_ONLY_USAGE_SCOPE`。
- 新增公共输入常量：`REFERENCE_URL_IMPORT_REQUESTED_CAPABILITIES`。
- 新增数据库能力：`AuditAction.reference_url_import`。
- 用途阻断放在 `assertAssetUsable`，覆盖后续 voice clone、avatar、publish 或 generation scope 调用，不依赖单一 API route。

### 验证命令
- RED: `npm run test:run -- tests/asset-consent.test.ts tests/reference-url-import-worker.test.ts tests/reference-api.test.ts` 先失败，原因是 reference-only scope 错误码不存在、禁止请求未阻断、worker 未写审计日志。
- GREEN: `npm run test:run -- tests/asset-consent.test.ts tests/reference-url-import-worker.test.ts tests/reference-api.test.ts`: 通过，3 files / 31 tests。
- 回归: `npm run test:run -- tests/reference-url-import-subtitle.test.ts tests/reference-url-import-worker.test.ts tests/workflow-worker-artifact-service.test.ts tests/reference-api.test.ts tests/reference-url-import-config.test.ts tests/reference-url-import-parser.test.ts tests/reference-source-schema.test.ts tests/reference-asset-extraction-service.test.ts tests/reference-asr-service.test.ts tests/asset-consent.test.ts tests/audit-log.test.ts tests/asset-ui.test.ts`: 通过，12 files / 66 tests。
- `npx prisma generate && npx prisma migrate deploy`: 通过，并应用 `20260623093000_add_reference_url_import_audit_action`。
- `npm run lint`: 通过。
- `npm run build`: 通过。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 10。
- 是否满足对应 Acceptance Criteria：满足成功/失败导入审计、禁止完整视频/cookie/去水印/批量采集、公开链接导入素材仅允许 `reference_analysis_only` 的用途阻断。
- 是否允许勾选：允许勾选 Task 10，不允许勾选 Task 11-14 或 Checkpoint 14。
- 下一步：Task 11，实现 UI 状态和用户确认，展示 metadata、字幕可用性、推荐 importMode、失败 fallback 和 reference-analysis-only 授权确认文案。

### Task 11: UI 状态和用户确认

### 任务
- Spec: `voflow-reference-url-import`
- Task: 11
- Requirements: US-1.1、US-2.1、US-3.1、US-4.1、US-4.5

### 修改文件
- `src/app/dashboard/hot-content/page.tsx`
- `src/components/references/types.ts`
- `src/lib/references/ui.ts`
- `tests/reference-components.test.tsx`
- `tests/reference-ui.test.ts`

### 范围说明
- 本次完成：爆款提取 UI 的参考链接入口切换为两步链路：先调用 `POST /api/projects/{projectId}/references/url/parse` 解析 metadata，再调用 `POST /api/projects/{projectId}/references/{referenceSourceId}/import` 确认导入。
- UI 解析后展示 metadata 标题、平台、时长、封面、字幕可用性、推荐 importMode 和失败 fallback。
- 有可用字幕时默认推荐 `subtitle_only`；无字幕时默认推荐 `audio_extract`，并提示可改用上传素材。
- 导入前展示 reference-analysis-only 授权确认；`subtitle_only` 和 `audio_extract` 需要勾选授权确认后才能提交，`metadata_only` 可直接保存 metadata。
- 页面明确展示合规边界：参考链接导入不是下载器，不提供完整视频下载、cookie/登录态导入、去水印或批量采集。

### 硬编码检查
- 是否新增运行时硬编码：未新增散落错误码或导入限制；URL 导入错误文案继续复用 `src/lib/references/url-import/config.ts`。
- UI 状态文案是否收口：新增 `getReferenceUrlImportUiState()`、`REFERENCE_URL_IMPORT_CONSENT_TEXT`、`REFERENCE_URL_IMPORT_BOUNDARY_TEXT` 和 consent version，集中在 `src/lib/references/ui.ts`。
- 是否暴露完整视频/cookie/去水印/批量入口：否，页面只提供 metadata、字幕、授权后音频三种参考分析路径。

### 公共化检查
- 复用的公共模块：`getReferenceFallbackMessage`、`selectPreferredSubtitleTrack`、`formatMediaDuration`、统一 API response 类型。
- 新增公共函数：`getReferenceUrlImportUiState()`，供页面和测试统一判断字幕可用性、推荐 importMode、授权文案和 fallback。
- 类型同步：`ReferenceSourceViewModel` 补齐 `title`、`thumbnailUrl`、`metadataJson`、`subtitleJson`、`importMode`、`consentStatus` 等 serializer 字段。

### 验证命令
- RED: `npm run test:run -- tests/reference-ui.test.ts` 先失败，原因是 `getReferenceUrlImportUiState` 不存在。
- RED: `npm run test:run -- tests/reference-components.test.tsx` 先失败，原因是爆款提取页面未展示 metadata、字幕可用性、推荐导入方式、reference-analysis-only 和完整视频下载边界文案。
- GREEN: `npm run test:run -- tests/reference-ui.test.ts tests/reference-components.test.tsx`: 通过，2 files / 10 tests。
- 回归: `npm run test:run -- tests/reference-ui.test.ts tests/reference-components.test.tsx tests/reference-api.test.ts tests/reference-url-import-config.test.ts tests/reference-url-import-parser.test.ts tests/reference-url-import-subtitle.test.ts tests/reference-url-import-worker.test.ts tests/reference-source-schema.test.ts`: 通过，8 files / 49 tests。
- `npm run lint`: 通过。
- `npm run build`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 11。
- 是否满足对应 Acceptance Criteria：满足 metadata 展示、字幕可用性展示、推荐 importMode、失败 fallback、reference-analysis-only 授权确认和 MVP 合规边界文案。
- 是否允许勾选：允许勾选 Task 11，不允许勾选 Task 12-14 或 Checkpoint 14。
- 下一步：Task 12，按任务清单补齐/复核单元、service、worker、API 测试覆盖，并把已有 Task 0-11 测试映射到清单缺口。

### Task 12: 添加/复核测试覆盖

### 任务
- Spec: `voflow-reference-url-import`
- Task: 12
- Requirements: US-1、US-2、US-3、US-4、NFR-4

### 修改文件
- `tests/reference-url-import-parser.test.ts`
- `tests/reference-url-import-worker.test.ts`
- `.kiro/specs/voflow-reference-url-import/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`

### 范围说明
- 本次完成：复核 Task 12 清单中 unit/service/worker/API 覆盖点，并补齐音频提取参数安全、metadata 输出大小限制、worker 时长限制、worker 音频大小限制四个缺口。
- 未改生产代码；本轮新增的是回归测试和覆盖映射记录。

### 覆盖映射
| 覆盖点 | 测试文件 | 当前状态 |
| --- | --- | --- |
| metadata normalize | `tests/reference-url-import-parser.test.ts` | 覆盖 title、durationMs、thumbnail、extractor、subtitle/automaticCaptions、bounded rawSummary |
| 字幕选择 | `tests/reference-url-import-subtitle.test.ts` | 覆盖人工中文字幕优先、无人工字幕时自动字幕 fallback |
| 字幕解析 | `tests/reference-url-import-subtitle.test.ts` | 覆盖 VTT/SRT 清洗文本和有序 ASR segments |
| duration limit | `tests/reference-url-import-worker.test.ts` | 新增覆盖 `REFERENCE_DURATION_LIMIT_EXCEEDED`，并断言不调用 yt-dlp/上传/reference_extract |
| size limit | `tests/reference-url-import-parser.test.ts`、`tests/reference-url-import-worker.test.ts` | 新增覆盖 metadata stdout 超限与提取后音频超限 |
| unsupported fallback | `tests/reference-api.test.ts`、`tests/reference-ui.test.ts` | 覆盖 feature disabled、platform not allowlisted、display fallback copy |
| command args 安全 | `tests/reference-url-import-parser.test.ts` | 覆盖 metadata 与 audio extract 均通过 spawn args、`shell:false`，并包含 `--no-playlist`/`--max-filesize` |
| metadata parse service/API | `tests/reference-api.test.ts` | 覆盖 parse endpoint 创建/更新 `metadata_ready` ReferenceSource、team isolation 和 feature flag |
| confirm import service/API | `tests/reference-api.test.ts` | 覆盖 `metadata_only`、`subtitle_only` consent required、字幕确认后入队、音频开关禁用、跨 team 拒绝 |
| subtitle creates Script/AsrSegment | `tests/reference-url-import-worker.test.ts` | 覆盖 `Script(sourceType=asr)`、`AsrSegment`、`structureJson` 和成功审计 |
| audio creates Asset/Consent/WorkflowNode | `tests/reference-url-import-worker.test.ts`、`tests/workflow-worker-artifact-service.test.ts`、`tests/reference-asset-extraction-service.test.ts` | 覆盖 audio Asset、AssetConsent(`reference_analysis_only`)、reference_extract 衔接和 handler 注册 |
| failed import writes AuditLog | `tests/reference-url-import-worker.test.ts` | 覆盖失败写 `AuditLog(action=reference_url_import)` 和 failureReason |
| API team isolation | `tests/reference-api.test.ts` | 覆盖跨 team import/retry/list/get 隔离 |
| consent required | `tests/reference-api.test.ts` | 覆盖字幕/音频确认前必须 reference-analysis-only 授权 |

### 硬编码检查
- 是否新增运行时硬编码：否，本轮只新增测试断言和执行反馈。
- 是否依赖真实外网或真实 yt-dlp：否，`YtDlpClient` 测试使用 fake spawn，worker 测试使用 fake extractor/storage/referenceExtractTask。
- 是否新增 mock/provider 占位到运行时代码：否。

### 公共化检查
- 复用的公共模块：现有 `YtDlpClient`、`createReferenceUrlImportWorkflowNodeHandler`、API route 测试 helper 和 Prisma 测试清理逻辑。
- 新增公共函数：无。
- 覆盖缺口处理：Task 12 清单项均已映射到测试文件；新增缺口测试集中在 parser/client 与 worker 两个现有测试文件，未创建重复测试工具。

### 验证命令
- 补充测试: `npm run test:run -- tests/reference-url-import-parser.test.ts tests/reference-url-import-worker.test.ts`: 通过，2 files / 11 tests。
- 回归: `npm run test:run -- tests/reference-url-import-config.test.ts tests/reference-url-import-parser.test.ts tests/reference-url-import-subtitle.test.ts tests/reference-url-import-worker.test.ts tests/reference-api.test.ts tests/reference-source-schema.test.ts tests/reference-asset-extraction-service.test.ts tests/asset-consent.test.ts tests/workflow-worker-artifact-service.test.ts tests/reference-ui.test.ts tests/reference-components.test.tsx`: 通过。
- `npm run lint`: 通过。
- `npm run build`: 通过。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 12。
- 是否满足对应 Acceptance Criteria：满足 unit、service、worker、API 覆盖复核；新增测试覆盖 duration/size limit 和 command args 安全缺口。
- 是否允许勾选：允许勾选 Task 12，不允许勾选 Task 13-14 或 Checkpoint 14。
- 下一步：Task 13，更新本地运行文档，说明 yt-dlp/ffmpeg 可选安装、配置项默认禁用策略、国内平台 fallback 口径。

### Task 13: 更新本地运行文档

### 任务
- Spec: `voflow-reference-url-import`
- Task: 13
- Requirements: US-1.3、US-1.5、US-4.5、NFR-3

### 修改文件
- `docs/04-本地运行项目教程.md`
- `.kiro/specs/voflow-reference-url-import/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`

### 范围说明
- 本次完成：在本地运行文档中补充 `yt-dlp` 和 `ffmpeg` 可选安装/检查步骤。
- 明确 Docker Compose 只启动 PostgreSQL、Redis 和 MinIO，不会自动安装 `yt-dlp`/`ffmpeg`；宿主机运行 `npm run dev` 时需要宿主机可执行文件。
- 补充公开参考链接导入配置项、默认禁用策略、allowlist 默认值、完整视频下载默认禁用策略。
- 补充真实导入验证流程：metadata 解析、字幕优先、授权后音频、fallback。
- 补充 FAQ：`yt-dlp` 不可用、音频提取失败、国内平台 fallback。

### 硬编码检查
- 是否新增运行时硬编码：否，本轮只改文档和 Kiro 状态。
- 配置项是否与代码一致：文档使用 `.env.example` 与 `buildReferenceLinkImportConfig()` 中已有配置项：`VOFLOW_REFERENCE_LINK_IMPORT_ENABLED`、`VOFLOW_YTDLP_BIN`、`VOFLOW_YTDLP_TIMEOUT_MS`、`VOFLOW_REFERENCE_MAX_DURATION_MS`、`VOFLOW_REFERENCE_MAX_AUDIO_MB`、`VOFLOW_REFERENCE_MAX_METADATA_BYTES`、`VOFLOW_REFERENCE_MAX_SUBTITLE_BYTES`、`VOFLOW_REFERENCE_ALLOW_AUDIO_EXTRACT`、`VOFLOW_REFERENCE_ALLOW_FULL_VIDEO_DOWNLOAD`、`VOFLOW_REFERENCE_ALLOWED_PLATFORMS`。
- 合规边界是否明确：文档明确 MVP 不提供完整视频下载、cookie/登录态导入、去水印或批量采集。

### 公共化检查
- 复用的公共来源：`src/lib/references/url-import/config.ts`、`.env.example`、`src/lib/references/platforms.ts` 和现有本地运行文档结构。
- 新增公共函数/service：无。
- 未新增运行时代码。

### 验证命令
- `rg -n "VOFLOW_REFERENCE|yt-dlp|ffmpeg|国内平台|完整视频|cookie|去水印|批量采集" docs/04-本地运行项目教程.md .env.example`: 通过，确认文档包含配置、安装、默认禁用和 fallback 口径。
- `npm run test:run -- tests/reference-url-import-config.test.ts tests/reference-url-import-parser.test.ts tests/reference-url-import-worker.test.ts tests/reference-api.test.ts`: 通过。
- `npm run lint`: 通过。
- `npm run build`: 通过。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 13。
- 是否满足对应 Acceptance Criteria：满足本地安装说明、Docker/Homebrew 配置说明、默认禁用策略、国内平台 fallback 和合规边界说明。
- 是否允许勾选：允许勾选 Task 13，不允许勾选 Task 14 或 Checkpoint 14。
- 下一步：Task 14，执行参考链接真实导入 Checkpoint 验收，逐条对照 metadata、字幕、音频、失败 fallback 和审计日志。

### Task 14: Checkpoint 参考链接真实导入验收

### 任务
- Spec: `voflow-reference-url-import`
- Task: 14
- Requirements: US-1、US-2、US-3、US-4、NFR-1、NFR-2、NFR-3、NFR-4

### 修改文件
- `.kiro/specs/voflow-reference-url-import/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`

### 验收核对
| Checkpoint | 证据 | 结论 |
| --- | --- | --- |
| 用户粘贴白名单公开链接后可看到 metadata | `tests/reference-api.test.ts` 覆盖 parse API 创建/更新 `ReferenceSource(status=metadata_ready)`，写入 title、durationMs、thumbnailUrl、metadataJson；`tests/reference-components.test.tsx` 和 `tests/reference-ui.test.ts` 覆盖页面 metadata、平台、时长、封面和 fallback 展示 | 通过 |
| 有字幕链接可生成 Script、AsrSegment 和 structureJson | `tests/reference-url-import-worker.test.ts` 覆盖 `subtitle_only` 选择优先字幕、下载字幕、创建 `Script(sourceType=asr)`、写入 `AsrSegment`、生成 `structureJson` 和成功审计 | 通过 |
| 无字幕链接在授权后可提取音频并复用 reference_extract | `tests/reference-url-import-worker.test.ts` 覆盖 `audio_extract` 创建 `Asset(type=audio)`、`AssetConsent(usageScope=reference_analysis_only)` 并创建 `reference_extract` workflow；`tests/reference-asset-extraction-service.test.ts` 覆盖 `reference_analysis_only` 可被参考分析链路使用 | 通过 |
| 未授权、超时、超长、平台不支持、完整视频下载请求均返回明确 fallback | `tests/reference-api.test.ts` 覆盖 consent required、unsupported platform、完整视频/cookie/去水印/批量采集阻断；`tests/reference-url-import-worker.test.ts` 覆盖 duration limit、audio size limit 和失败审计；`tests/reference-url-import-parser.test.ts` 覆盖 metadata stdout size limit 和 command args 安全 | 通过 |
| 审计日志包含 sourceUrl、platform、importMode、consentTextVersion、ytDlpVersion 和失败原因 | `tests/reference-api.test.ts` 覆盖 confirm import 写入 consentTextVersion；`tests/reference-url-import-worker.test.ts` 覆盖成功/失败 `AuditLog(action=reference_url_import)` 的 metadata 字段 | 通过 |
| 验收命令包含 focused tests、lint 和必要 build | 本 checkpoint 执行 focused test suite、`npm run lint`、`npm run build`、`git diff --check` | 通过 |

### 范围说明
- 本次完成：逐条核对公开参考链接 metadata、字幕优先导入、授权后音频提取、失败 fallback 和审计日志覆盖。
- 自动化验收使用 fake `YtDlpClient`/fake extractor/fake storage 覆盖真实落库、入队和产物创建链路，不访问外网、不调用真实 yt-dlp、不上传真实 MinIO，符合 NFR-4。
- 真实公网链接的人工验证入口和环境开关已在 Task 13 文档中说明；默认配置仍保持 `VOFLOW_REFERENCE_LINK_IMPORT_ENABLED=false` 和完整视频下载禁用。

### 硬编码检查
- 是否新增运行时硬编码：否，本轮仅更新 Kiro 状态文档。
- 配置、错误码、平台白名单、限制和 fallback 文案仍由 `src/lib/references/url-import/config.ts`、`.env.example` 和 `src/lib/references/ui.ts` 收口。
- 未新增完整视频下载、cookie/登录态导入、去水印或批量采集入口。

### 公共化检查
- 复用的公共模块：`ReferenceLinkParser`、`YtDlpClient`、`selectPreferredSubtitleTrack`、字幕解析、`createReferenceUrlImportWorkflowNodeHandler`、`createReferenceExtractTask`、`assertAssetUsable`、`writeAuditLog`、URL import UI state helper。
- 新增公共函数/service：无。
- 本轮未改生产代码，无需新增抽象。

### 验证命令
- Focused: `npm run test:run -- tests/reference-url-import-config.test.ts tests/reference-url-import-parser.test.ts tests/reference-url-import-subtitle.test.ts tests/reference-url-import-worker.test.ts tests/reference-api.test.ts tests/reference-source-schema.test.ts tests/reference-asset-extraction-service.test.ts tests/reference-asr-service.test.ts tests/asset-consent.test.ts tests/audit-log.test.ts tests/asset-ui.test.ts tests/workflow-worker-artifact-service.test.ts tests/reference-ui.test.ts tests/reference-components.test.tsx`: 通过。
- `npm run lint`: 通过。
- `npm run build`: 通过。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 14。
- 是否满足对应 Acceptance Criteria：满足 metadata 展示、字幕生成 Script/AsrSegment/structureJson、授权音频提取并复用 reference_extract、失败 fallback、审计日志字段和 focused tests/lint/build 验收。
- 是否允许勾选：允许勾选 Task 14；`voflow-reference-url-import` 当前 Spec 已完成 checkpoint，后续只保留最终 MVP 环境复验。
- 下一步：按总控 plan 启动下一个 Spec，建议进入 `voflow-voice-clone` 的拆分/任务执行判断；如要先做环境级验收，可按 Task 13 文档开启真实链接导入开关后进行人工公网链接复验。
