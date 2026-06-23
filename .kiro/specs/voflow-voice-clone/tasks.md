# Tasks: voflow-voice-clone

## Implementation Plan

- [x] 0. 执行后续开发规范检查
  - 先阅读 `docs/03-VoFlow开发执行规范.md`
  - 本 Spec 不得在 Worker、API 或 UI 中散写声音样本格式、质量阈值、训练服务地址、usage scope、状态文案或错误码
  - 声音样本上传必须复用素材能力；授权校验、训练 provider、voice serializer 和 API 响应必须进入公共 helper/service
  - 若发现同类逻辑已经重复两处以上，先抽公共函数或公共常量，再继续业务实现
  - Checkpoint 反馈必须包含硬编码检查、公共函数提取情况和验证命令
  - _Requirements: US-1, US-2, US-3, US-4_

- [x] 1. 创建声音克隆数据表
  - 创建 `voice_samples`
  - 创建 `voice_consents`
  - 创建 `voice_clone_jobs`
  - _Requirements: US-1, US-2, US-3_

- [x] 2. 实现声音样本上传
  - 复用 asset upload
  - 限定音频格式
  - 保存 voice_sample metadata
  - _Requirements: US-1_

- [x] 3. 实现声音质量检测
  - 检查时长
  - 检查音量和静音比例
  - 检查噪声或使用 mock quality report
  - _Requirements: US-1_

- [x] 4. 实现声音授权确认
  - 展示授权文本
  - 保存 voice_consents
  - usage_scope 包含 voice_clone 和 tts_generation
  - _Requirements: US-2_

- [x] 5. 实现本地训练任务创建
  - 校验样本合格
  - 校验授权已确认
  - 创建 voice_clone workflow node
  - _Requirements: US-3_

- [ ] 6. 实现本地 Voice Trainer Adapter
  - 支持 GPT-SoVITS/CosyVoice 或 mock trainer
  - 返回 model_id、sample_url、训练日志
  - 失败时写入 error_json
  - _Requirements: US-3_

- [ ] 7. 将训练结果写入 voices
  - 创建 cloned voice 记录
  - status 为 active
  - license_status 为 approved
  - _Requirements: US-3, US-4_

- [ ] 8. 实现我的声音页面
  - 展示预置音色和克隆音色
  - 支持试听、重训、删除
  - 展示授权状态和训练状态
  - _Requirements: US-4_

- [ ] 9. 实现删除/禁用克隆音色
  - 设置 voice status disabled
  - 新 TTS 任务不能选择 disabled 音色
  - 历史任务保留引用
  - _Requirements: US-4_

- [ ] 10. 添加测试
  - 未授权不能训练
  - 样本不合格被拒绝
  - mock trainer 生成 cloned voice
  - disabled voice 不能用于 TTS
  - _Requirements: US-1, US-2, US-3, US-4_

- [ ] 11. Checkpoint: 声音克隆验收
  - 用户上传声音样本并授权
  - 本地训练生成克隆音色
  - 我的声音页面可试听、重训、删除
  - 克隆音色可用于 TTS
  - _Requirements: US-1, US-2, US-3, US-4_

## 执行反馈

### Task 0: 后续开发规范检查与任务执行判断

### 任务
- Spec: `voflow-voice-clone`
- Task: 0
- Requirements: US-1、US-2、US-3、US-4

### 修改文件
- `.kiro/specs/voflow-voice-clone/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`

### 范围说明
- 本次完成：读取并对照 `docs/03-VoFlow开发执行规范.md`，确认 `voflow-voice-clone` 的 `requirements.md`、`design.md`、`tasks.md` 已存在，且当前计划允许从 `voflow-reference-url-import` checkpoint 完成后进入本 Spec。
- 当前任务执行判断：Task 1 是下一个可执行任务，应先创建 `voice_samples`、`voice_consents`、`voice_clone_jobs` 数据表和迁移，再进入上传、质检、授权和训练链路。
- 明确未完成：本轮未创建数据库表、未实现 API、未实现 UI、未实现 trainer adapter。
- 是否使用 mock/provider/adapter 占位：本轮未实现运行时代码；后续 Task 6 如使用 mock trainer，必须在执行反馈中明确标注 mock/provider 边界。

### 规范检查结论
- 配置与硬编码：声音样本格式、质量阈值、训练 provider、训练服务地址、usage scope、状态文案和错误码不得散写到 Worker/API/UI；后续应新增或复用 voice clone 专用常量/config 模块。
- API 规范：后续 `/api/voices/samples`、`/api/voices/samples/{sampleId}/consents`、`/api/voices/clone` 必须复用 `requireAuth`、统一 API response、Zod 校验和 serializer。
- 数据模型：现有 Prisma 已有 `Voice`、`TtsRequest`、`Asset`、`AssetConsent` 和 workflow node；Task 1 只补声音克隆专属 sample/consent/job 模型，避免重复建 voice 主表。
- Worker 规范：`voice_clone` 已存在于 workflow constants；后续 worker payload 必须复用 workflow node/job 结构，错误状态要写入可重试节点。
- 测试规范：Task 1 先补 schema/migration 级测试或 Prisma schema 检查；后续 API 覆盖未登录、跨 team、校验失败、成功路径。

### 硬编码检查
- 是否新增运行时硬编码：否，本轮只更新 Kiro 状态文档。
- 新增配置是否收口：本轮未新增配置；Task 1-3 如新增格式/时长/质量阈值，应收口到 voice clone 配置或常量模块。
- 新增错误码/状态/枚举是否收口：本轮未新增；Task 1 如新增 Prisma enum 或错误码，必须同步 migration、serializer 和测试。

### 公共化检查
- 复用的公共模块：`src/lib/assets/consent.ts`、`src/lib/assets/validation.ts`、`src/lib/tts/serializer.ts`、`src/services/voiceService.ts`、`src/services/ttsService.ts`、`src/lib/workflow/constants.ts`、统一 API response 和 `requireAuth`。
- 新增的公共函数/service：无。
- 后续需要抽取的重复逻辑：声音授权 scope、样本质检阈值、voice clone 错误码和 trainer provider 配置。

### 验证命令
- `rg -n "voice_clone|Voice|AssetConsent|usageScope|WorkflowNodeType" src prisma tests .env.example package.json`: 通过，确认已有 TTS/Voice、资产授权和 workflow 基础能力。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 0。
- 是否满足对应 Acceptance Criteria：满足启动新 Spec 前的规范检查和任务执行判断；US-1 到 US-4 的业务实现从 Task 1 开始。
- 是否允许勾选：允许勾选 Task 0，不允许勾选 Task 1-11。
- MVP 状态矩阵是否需要同步更新：需要，`voflow-voice-clone` 从 `not_started` 进入 `partial`，下一步为 Task 1 创建声音克隆数据表。

### Task 1: 创建声音克隆数据表

### 任务
- Spec: `voflow-voice-clone`
- Task: 1
- Requirements: US-1、US-2、US-3

### 修改文件
- `prisma/schema.prisma`
- `prisma/migrations/20260623102000_add_voice_clone_models/migration.sql`
- `tests/voice-clone-schema.test.ts`
- `tests/workflow-constants.test.ts`
- `.kiro/specs/voflow-voice-clone/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`

### 范围说明
- 本次完成：新增声音克隆专属 `VoiceSample`、`VoiceConsent`、`VoiceCloneJob` Prisma 模型，并创建对应 `voice_samples`、`voice_consents`、`voice_clone_jobs` migration。
- 明确未完成：未实现样本上传 API、质量检测、授权确认 API、训练任务创建、trainer adapter 或 UI。
- 是否使用 mock/provider/adapter 占位：否，本轮只完成数据库结构。
- 避免重复建表：继续复用 TTS Spec 已有 `Voice`、`VoiceType.cloned`、`VoiceStatus` 和 `voices` 表；本轮没有新增 cloned voice 主表。

### TDD 记录
- RED: 先新增 `tests/voice-clone-schema.test.ts`，运行 `npm run test:run -- tests/voice-clone-schema.test.ts` 失败，原因是本地数据库只有既有 `voices` 表，缺少 `voice_samples`、`voice_consents`、`voice_clone_jobs`。
- GREEN: 补充 Prisma schema 和 migration，执行 `npx prisma migrate deploy` 后，`tests/voice-clone-schema.test.ts` 通过，1 file / 3 tests。

### 数据模型说明
- `voice_samples` 关联 `assets`、`teams`、`users`，保存 `durationMs` 和 `qualityReport`，为后续样本上传和质量检测提供落点。
- `voice_consents` 关联 `voice_samples` 和 `users`，保存 `consentText`、`usageScope`、`ipAddress`、`device`，为后续声音授权提供落点。
- `voice_clone_jobs` 关联 `workflow_nodes`、`voice_samples`，可选关联输出 `voices`，复用 `WorkflowNodeStatus` 表示训练状态。
- `voice_clone_jobs.workflowNodeId` 使用唯一索引，保证一个 workflow node 对应一个声音克隆 job。

### 硬编码检查
- 是否新增运行时硬编码：否，本轮只新增 Prisma schema、migration 和测试。
- 新增配置是否收口：本轮未新增配置。
- 新增错误码/状态/枚举是否收口：未新增错误码；训练状态复用已有 `WorkflowNodeStatus`，避免新增重复 enum。

### 公共化检查
- 复用的公共模块：已有 `Voice`/`VoiceType.cloned`/`VoiceStatus`、`Asset`、`WorkflowNode`、`LicenseStatus`、`WorkflowNodeStatus`。
- 新增的公共函数/service：无。
- 后续需要抽取的重复逻辑：Task 2-4 应新增或复用 voice clone 常量/config 来收口样本格式、时长/质量阈值、授权 scope 和错误码。

### 验证命令
- RED: `npm run test:run -- tests/voice-clone-schema.test.ts`: 失败，缺少三张声音克隆表。
- `npx prisma format --schema prisma/schema.prisma`: 通过。
- `npx prisma validate --schema prisma/schema.prisma`: 通过。
- `npx prisma migrate deploy`: 通过，应用 `20260623102000_add_voice_clone_models`。
- `npm run db:generate`: 通过。
- `npm run test:run -- tests/voice-clone-schema.test.ts`: 通过，1 file / 3 tests。
- `npm run test:run -- tests/voice-clone-schema.test.ts tests/tts-service.test.ts tests/tts-api.test.ts tests/tts-worker-service.test.ts tests/workflow-constants.test.ts tests/avatar-schema.test.ts`: 通过，6 files / 31 tests。

### 验收结论
- 是否满足当前 task：满足 Task 1。
- 是否满足对应 Acceptance Criteria：满足 US-1、US-2、US-3 所需数据库落点，且不重复创建已有 `voices` 主表。
- 是否允许勾选：允许勾选 Task 1，不允许勾选 Task 2-11。
- MVP 状态矩阵是否需要同步更新：需要，`voflow-voice-clone` 继续保持 `partial`，下一步为 Task 2 实现声音样本上传。

### Task 2: 实现声音样本上传

### 任务
- Spec: `voflow-voice-clone`
- Task: 2
- Requirements: US-1

### 修改文件
- `src/services/assetUploadService.ts`
- `src/services/voiceSampleService.ts`
- `src/app/api/assets/upload/route.ts`
- `src/app/api/voices/samples/route.ts`
- `src/lib/voice-clone/constants.ts`
- `src/lib/voice-clone/serializer.ts`
- `tests/voice-sample-api.test.ts`
- `.kiro/specs/voflow-voice-clone/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`

### 范围说明
- 本次完成：新增 `POST /api/voices/samples` multipart API，上传声音样本时强制复用 `AssetType.audio` 校验、对象存储上传、`asset_upload` 审计和 asset serializer。
- 新增公共 `uploadAssetFile()`，将原 `/api/assets/upload` 中的资产校验、MinIO 上传、Asset 写库和审计逻辑抽到 service；原 asset upload route 改为复用该 service。
- 新增 `createVoiceSampleFromUpload()`，在同一数据库事务中创建 `Asset(type=audio)` 和 `VoiceSample`，保证 voice sample metadata 与素材记录一致。
- 声音样本 asset metadata 写入 `sourceType=voice_sample` 和可选 `durationMs`；`voice_samples.durationMs` 同步保存。
- 明确未完成：本轮不做清晰度/静音/噪声检测，不判断样本太短；这些留给 Task 3。
- 是否使用 mock/provider/adapter 占位：测试 mock 了 storage，不访问真实 MinIO；运行时代码仍调用真实 storage adapter。

### TDD 记录
- RED: 先新增 `tests/voice-sample-api.test.ts`，运行 `npm run test:run -- tests/voice-sample-api.test.ts` 失败，原因是 `@/app/api/voices/samples/route` 不存在。
- GREEN: 新增 voice sample route/service/serializer，并抽取 `uploadAssetFile()` 后，`tests/voice-sample-api.test.ts` 通过，1 file / 3 tests。
- 返修: `npm run build` 首次失败，原因是 Prisma JSON 字段不能直接传 TypeScript `null`；修正为 `Prisma.JsonNull` 后 build 通过。

### 硬编码检查
- 是否新增运行时硬编码：未在 route/service 中散写 MIME 白名单或大小限制；声音样本格式限制复用 `validateAsset(..., AssetType.audio)` 和 `ASSET_MIME_TYPE_WHITELIST.audio`。
- 新增配置是否收口：本轮未新增配置。
- 新增错误码/状态/枚举是否收口：新增声音样本 duration 参数错误码和 API 文案收口到 `src/lib/voice-clone/constants.ts`；未新增 Prisma enum。

### 公共化检查
- 复用的公共模块：`validateAsset`、`uploadAsset`/`ensureBucketExists`/`deleteAsset`、`writeAuditLog`、`serializeAsset`、`requireAuth`、统一 API response。
- 新增的公共函数/service：`uploadAssetFile()`、`createVoiceSampleFromUpload()`、`serializeVoiceSample()`。
- 后续需要抽取的重复逻辑：Task 3 应继续把时长、音量、静音比例、噪声阈值收口到 voice clone 常量/config，而不是写在 route 中。

### 验证命令
- RED: `npm run test:run -- tests/voice-sample-api.test.ts`: 失败，缺少 `/api/voices/samples` route。
- GREEN: `npm run test:run -- tests/voice-sample-api.test.ts`: 通过，1 file / 3 tests。
- `npm run test:run -- tests/voice-sample-api.test.ts tests/voice-clone-schema.test.ts tests/asset-serializer.test.ts tests/asset-consent.test.ts tests/tts-service.test.ts tests/tts-api.test.ts tests/workflow-constants.test.ts`: 通过，7 files / 40 tests。
- `npx prisma validate --schema prisma/schema.prisma`: 通过。
- `npm run lint`: 通过。
- `npm run build`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 2。
- 是否满足对应 Acceptance Criteria：满足 US-1 的声音样本上传基础链路：上传音频样本后保存 `Asset(type=audio)` 与 `VoiceSample`，非音频格式被拒绝。
- 是否允许勾选：允许勾选 Task 2，不允许勾选 Task 3-11。
- MVP 状态矩阵是否需要同步更新：需要，`voflow-voice-clone` 继续保持 `partial`，下一步为 Task 3 实现声音质量检测。

### Task 3: 实现声音质量检测

### 任务
- Spec: `voflow-voice-clone`
- Task: 3
- Requirements: US-1

### 修改文件
- `src/lib/voice-clone/constants.ts`
- `src/lib/voice-clone/quality.ts`
- `src/services/voiceSampleService.ts`
- `src/app/api/voices/samples/route.ts`
- `tests/voice-sample-api.test.ts`
- `.kiro/specs/voflow-voice-clone/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`

### 范围说明
- 本次完成：为声音样本上传链路新增质量检测，覆盖最小时长、平均音量、静音比例和噪声等级。
- 上传 API 在写入 Asset/VoiceSample 前执行质量检测；样本过短或质量未通过时返回明确错误码和 `qualityReport`，不产生素材或声音样本半成品。
- 成功上传时将 `qualityReport` 写入 `voice_samples.qualityReport`，并同步写入 asset metadata；后续训练任务可复用同一份质量结论。
- 明确未完成：本轮未接入真实音频波形分析器或外部质量检测 provider。
- 是否使用 mock/provider/adapter 占位：使用 mock quality metrics 作为缺省检测输入，缺省值收口到 `VOICE_SAMPLE_MOCK_QUALITY_METRICS`；如果请求显式传入 `averageVolumeDb`、`silenceRatio`、`noiseLevel`，则按传入值检测。

### TDD 记录
- RED: 先扩展 `tests/voice-sample-api.test.ts`，要求成功响应和数据库写入 `qualityReport`，并要求短样本、静音/噪声过高样本被拒绝；运行 `npm run test:run -- tests/voice-sample-api.test.ts` 失败，原因是 route 未生成 quality report 且不阻断不合格样本。
- GREEN: 新增 `analyzeVoiceSampleQuality()` 和 `getVoiceSampleQualityFailureCode()`，route 解析质量指标并在上传资产前执行检测后，`tests/voice-sample-api.test.ts` 通过，1 file / 5 tests。

### 硬编码检查
- 是否新增运行时硬编码：未在 route 中散写阈值、mock 指标、文案或错误码。
- 新增配置是否收口：最小时长、最低音量、最大静音比例、最大噪声等级收口到 `VOICE_SAMPLE_QUALITY_LIMITS`；mock 缺省指标收口到 `VOICE_SAMPLE_MOCK_QUALITY_METRICS`。
- 新增错误码/状态/枚举是否收口：`VOICE_SAMPLE_TOO_SHORT`、`VOICE_SAMPLE_TOO_QUIET`、`VOICE_SAMPLE_SILENCE_TOO_HIGH`、`VOICE_SAMPLE_NOISY`、`VOICE_SAMPLE_QUALITY_NOT_PASSED`、`VOICE_SAMPLE_QUALITY_METRIC_INVALID` 均收口到 `src/lib/voice-clone/constants.ts`。

### 公共化检查
- 复用的公共模块：`requireAuth`、统一 API response、`uploadAssetFile()`、`createVoiceSampleFromUpload()`、asset serializer、voice sample serializer。
- 新增的公共函数/service：`analyzeVoiceSampleQuality()`、`getVoiceSampleQualityFailureCode()`。
- 后续需要抽取的重复逻辑：Task 5 创建训练任务时应复用 `VoiceSample.qualityReport` 和同一套错误码判断样本是否合格，不得重新实现阈值判断。

### 验证命令
- RED: `npm run test:run -- tests/voice-sample-api.test.ts`: 失败，quality report 为空且不合格样本未被阻断。
- GREEN: `npm run test:run -- tests/voice-sample-api.test.ts`: 通过，1 file / 5 tests。
- `npm run test:run -- tests/voice-sample-api.test.ts tests/voice-clone-schema.test.ts tests/asset-serializer.test.ts tests/asset-consent.test.ts tests/tts-service.test.ts tests/tts-api.test.ts tests/workflow-constants.test.ts`: 通过，7 files / 42 tests。
- `npx prisma validate --schema prisma/schema.prisma`: 通过。
- `npm run lint`: 通过。
- `npm run build`: 通过。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 3。
- 是否满足对应 Acceptance Criteria：满足 US-1 的声音质量检测要求；不合格样本会被拒绝，合格样本保存结构化 quality report。
- 是否允许勾选：允许勾选 Task 3，不允许勾选 Task 4-11。
- MVP 状态矩阵是否需要同步更新：需要，`voflow-voice-clone` 继续保持 `partial`，下一步为 Task 4 实现声音授权确认。

### Task 4: 实现声音授权确认

### 任务
- Spec: `voflow-voice-clone`
- Task: 4
- Requirements: US-2

### 修改文件
- `src/lib/voice-clone/constants.ts`
- `src/lib/voice-clone/ui.ts`
- `src/lib/voice-clone/serializer.ts`
- `src/services/voiceSampleService.ts`
- `src/app/api/voices/samples/[sampleId]/consents/route.ts`
- `src/app/dashboard/voices/page.tsx`
- `tests/voice-sample-api.test.ts`
- `tests/voice-ui.test.tsx`
- `.kiro/specs/voflow-voice-clone/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`

### 范围说明
- 本次完成：新增 `POST /api/voices/samples/{sampleId}/consents`，复用 `requireAuth`、统一 JSON 校验、统一响应、request IP 提取、asset serializer 和 voice sample/consent serializer。
- 新增 `confirmVoiceSampleConsent()`，在 service 层校验样本归属、质量检测通过、授权文本非空、`usageScope` 同时包含 `voice_clone` 和 `tts_generation`。
- 授权成功时写入 `voice_consents`，保存 `consentText`、`usageScope`、`ipAddress`、`device`，并将声音样本对应 `Asset.licenseStatus` 更新为 `approved`。
- 我的声音页新增声音样本上传、质检结果提示、默认声音授权文本展示和确认授权提交。
- 明确未完成：本轮不创建训练任务、不接入 trainer adapter、不生成 cloned voice；这些留给 Task 5-7。
- 是否使用 mock/provider/adapter 占位：未新增 provider 或 mock trainer；声音质检仍沿用 Task 3 的 mock quality metrics 边界。

### TDD 记录
- RED: 先新增 `tests/voice-sample-api.test.ts` 授权用例和 `tests/voice-ui.test.tsx` UI/helper 用例，运行 `npm run test:run -- tests/voice-sample-api.test.ts tests/voice-ui.test.tsx` 失败，原因是 `voices/samples/[sampleId]/consents` route 和 `voice-clone/ui` helper 不存在。
- GREEN: 新增 voice consent 常量、UI helper、serializer、service、route，并在声音页接入上传后授权确认后，`tests/voice-sample-api.test.ts tests/voice-ui.test.tsx` 通过，2 files / 10 tests。

### 硬编码检查
- 是否新增运行时硬编码：未在 route 或 UI 提交流程中散写 usage scope、默认授权文本或错误码。
- 新增配置是否收口：`voice_clone`、`tts_generation` 收口到 `VOICE_CONSENT_USAGE_SCOPES`；前端选项收口到 `VOICE_CONSENT_USAGE_SCOPE_OPTIONS`；默认授权文本收口到 `DEFAULT_VOICE_CONSENT_TEXT`。
- 新增错误码/状态/枚举是否收口：`VOICE_SAMPLE_NOT_FOUND`、`VOICE_SAMPLE_CONSENT_REQUIRED` 和 `consentSuccess` 文案收口到 `src/lib/voice-clone/constants.ts`；未新增 Prisma enum 或 migration。

### 公共化检查
- 复用的公共模块：`requireAuth`、`invalidJsonBody`、`validationError`、`success`、`getRequestIpAddress`、`serializeAsset`、`serializeVoiceSample`、`Asset.licenseStatus`。
- 新增的公共函数/service：`voiceConsentRequestSchema`、`confirmVoiceSampleConsent()`、`serializeVoiceConsent()`、`DEFAULT_VOICE_CONSENT_TEXT`、`VOICE_CONSENT_USAGE_SCOPE_OPTIONS`。
- 后续需要抽取的重复逻辑：Task 5 创建训练任务时应直接复用 `VOICE_CONSENT_USAGE_SCOPES` 和 `voice_consents` 查询结果校验授权，不得重新散写 scope 字符串。

### 验证命令
- RED: `npm run test:run -- tests/voice-sample-api.test.ts tests/voice-ui.test.tsx`: 失败，缺少 consent route 和 UI helper。
- GREEN: `npm run test:run -- tests/voice-sample-api.test.ts tests/voice-ui.test.tsx`: 通过，2 files / 10 tests。
- `npm run test:run -- tests/voice-sample-api.test.ts tests/voice-ui.test.tsx tests/voice-clone-schema.test.ts tests/asset-serializer.test.ts tests/asset-consent.test.ts tests/tts-service.test.ts tests/tts-api.test.ts tests/workflow-constants.test.ts`: 通过，8 files / 47 tests。
- `npx prisma validate --schema prisma/schema.prisma`: 通过。
- `npm run lint`: 通过。
- `npm run build`: 通过。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 4。
- 是否满足对应 Acceptance Criteria：满足 US-2 的声音授权确认要求；授权文本可展示/提交，授权记录写入 `voice_consents`，`usageScope` 必须包含 `voice_clone` 和 `tts_generation`。
- 是否允许勾选：允许勾选 Task 4，不允许勾选 Task 5-11。
- MVP 状态矩阵是否需要同步更新：需要，`voflow-voice-clone` 继续保持 `partial`，下一步为 Task 5 实现本地训练任务创建。

### Task 5: 实现本地训练任务创建

### 任务
- Spec: `voflow-voice-clone`
- Task: 5
- Requirements: US-3

### 修改文件
- `src/lib/voice-clone/constants.ts`
- `src/services/voiceCloneService.ts`
- `src/app/api/voices/clone/route.ts`
- `src/app/dashboard/voices/page.tsx`
- `tests/voice-clone-service.test.ts`
- `tests/voice-clone-api.test.ts`
- `tests/voice-ui.test.tsx`
- `.kiro/specs/voflow-voice-clone/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`

### 范围说明
- 本次完成：新增 `POST /api/voices/clone`，创建本地声音克隆训练任务。
- 新增 `createVoiceCloneTrainingTask()`，复用当前 `VoiceSample.qualityReport` 判断样本合格，不重新计算质量阈值。
- 训练任务创建前校验 `voice_consents`，要求授权记录的 `usageScope` 包含 `VOICE_CONSENT_USAGE_SCOPES` 中的 `voice_clone` 和 `tts_generation`，不在 service/route 中散写 scope 字符串。
- 创建训练任务时在同一事务中写入 `WorkflowNode(nodeType=voice_clone)` 和 `VoiceCloneJob`，并更新 `VideoJob.status=queued`、`currentNode=voice_clone`。
- 事务提交后向 workflow queue 投递 `voice_clone` payload，后续 worker 可按 `voiceCloneJobId` 和 `voiceSampleId` 执行训练。
- 我的声音页在样本上传和声音授权确认后新增“开始声音训练”按钮，提交到 `/api/voices/clone`。
- 明确未完成：本轮不执行真实训练、不创建 cloned voice、不写入训练日志或 outputVoiceId；这些留给 Task 6-7。
- 是否使用 mock/provider/adapter 占位：`VoiceCloneJob.provider` 目前使用集中常量 `VOICE_CLONE_MOCK_PROVIDER=mock` 作为 Task 6 trainer adapter 的占位输入。

### TDD 记录
- RED: 新增 `tests/voice-clone-service.test.ts`、`tests/voice-clone-api.test.ts`，并扩展 `tests/voice-ui.test.tsx`；运行 `npm run test:run -- tests/voice-clone-service.test.ts tests/voice-clone-api.test.ts tests/voice-ui.test.tsx` 失败，原因是 `voiceCloneService`、`/api/voices/clone` 和“开始声音训练”按钮不存在。
- GREEN: 新增 voice clone service、API route 和 UI 提交入口后，focused tests 通过，3 files / 7 tests。

### 硬编码检查
- 是否新增运行时硬编码：未在 route 或 UI 中散写 node type、provider、usage scope 或错误码。
- 新增配置是否收口：`voice_clone` node type 收口到 `VOICE_CLONE_NODE_TYPE`；训练 provider 占位收口到 `VOICE_CLONE_MOCK_PROVIDER`；授权 scope 继续复用 `VOICE_CONSENT_USAGE_SCOPES`。
- 新增错误码/状态/枚举是否收口：`VOICE_CLONE_JOB_NOT_FOUND`、`VOICE_CLONE_TASK_CREATE_FAILED`、`VOICE_CLONE_TRAINING_FAILED` 和 `cloneTaskSuccess` 文案收口到 `src/lib/voice-clone/constants.ts`；未新增 Prisma enum 或 migration。

### 公共化检查
- 复用的公共模块：`requireAuth`、`invalidJsonBody`、`validationError`、`success`、`internalError`、`workflowQueue`、`createWorkflowTraceId`、`WORKFLOW_NODE_DEFINITIONS.voice_clone`、`VOICE_CONSENT_USAGE_SCOPES`。
- 新增的公共函数/service：`createVoiceCloneTrainingTask()`。
- 后续需要抽取的重复逻辑：Task 6 worker/trainer 应复用 `VOICE_CLONE_NODE_TYPE`、`VOICE_CLONE_MOCK_PROVIDER` 和 `voice_clone_jobs` 输入，不得重新拼接 provider/node type；Task 7 写入 cloned voice 时应复用已有 `Voice`/`VoiceType.cloned`/`VoiceStatus`。

### 验证命令
- RED: `npm run test:run -- tests/voice-clone-service.test.ts tests/voice-clone-api.test.ts tests/voice-ui.test.tsx`: 失败，缺少 service、API route 和 UI 训练按钮。
- GREEN: `npm run test:run -- tests/voice-clone-service.test.ts tests/voice-clone-api.test.ts tests/voice-ui.test.tsx`: 通过，3 files / 7 tests。
- `npm run test:run -- tests/voice-clone-service.test.ts tests/voice-clone-api.test.ts tests/voice-sample-api.test.ts tests/voice-ui.test.tsx tests/voice-clone-schema.test.ts tests/asset-serializer.test.ts tests/asset-consent.test.ts tests/tts-service.test.ts tests/tts-api.test.ts tests/workflow-constants.test.ts`: 通过，10 files / 52 tests。
- `npx prisma validate --schema prisma/schema.prisma`: 通过。
- `npm run lint`: 通过。
- `npm run build`: 通过。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 5。
- 是否满足对应 Acceptance Criteria：满足 US-3 的训练任务创建前半段：合格且已授权样本可创建 `voice_clone` workflow node 和 `voice_clone_jobs`，未授权或不合格样本被阻断。
- 是否允许勾选：允许勾选 Task 5，不允许勾选 Task 6-11。
- MVP 状态矩阵是否需要同步更新：需要，`voflow-voice-clone` 继续保持 `partial`，下一步为 Task 6 实现本地 Voice Trainer Adapter。
