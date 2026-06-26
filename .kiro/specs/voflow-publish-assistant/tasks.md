# Tasks: voflow-publish-assistant

## Implementation Plan

- [x] 0. 执行后续开发规范检查
  - 先阅读 `AI_RULES.md`
  - 本 Spec 不得在 API、Adapter 或 UI 中散写平台规则、标题长度、标签数量、token 状态、错误码、发布状态文案或重试策略
  - 平台规则、Channel Adapter、发布草稿 serializer、token 加密、参数检查和 API 响应必须进入公共 helper/service
  - 若发现同类逻辑已经重复两处以上，先抽公共函数或公共常量，再继续业务实现
  - Checkpoint 反馈必须包含硬编码检查、公共函数提取情况和验证命令
  - _Requirements: US-1, US-2, US-3, US-4_

- [x] 1. 创建发布相关数据表
  - 创建 `channel_accounts`
  - 创建 `publish_drafts`
  - 创建 `publishes`
  - 添加 platform 和 status 校验
  - _Requirements: US-1, US-2, US-4_

- [x] 2. 实现平台规则配置
  - 配置标题长度
  - 配置标签数量
  - 配置封面比例
  - 配置视频时长限制
  - _Requirements: US-1, US-3_

- [x] 3. 实现发布信息生成
  - 调用本地 LLM 生成标题、描述、标签、话题
  - 按平台生成独立草稿
  - 保存 publish_drafts
  - _Requirements: US-1_

- [x] 4. 实现发布草稿编辑 API
  - 查询草稿
  - 修改标题、描述、标签、话题、封面
  - 保存平台独立草稿
  - _Requirements: US-1_

- [x] 5. 实现渠道账号模型和状态展示
  - 支持 connected、expired、not_connected
  - 返回账号昵称和过期时间
  - token 加密存储
  - _Requirements: US-2_

- [x] 6. 实现 OAuth/授权占位接口
  - MVP 可先使用 mock channel account
  - 真实平台接入保留 adapter
  - token 过期时展示重新授权入口
  - _Requirements: US-2_

- [x] 7. 实现发布参数检查
  - 校验视频比例、标题长度、标签数量、封面尺寸
  - 校验 channel account 状态
  - 保存 validation_json
  - _Requirements: US-3_

- [x] 8. 实现 Channel Adapter 接口
  - `uploadVideo`
  - `publish`
  - `getStatus`
  - `retry`
  - 实现 mock adapter
  - _Requirements: US-4_

- [x] 9. 实现一键发布 API
  - 只对检查通过且 connected 的平台创建发布任务
  - expired 或 not_connected 平台标记 skipped
  - 保存 request_id 和平台结果
  - _Requirements: US-4_

- [x] 10. 实现失败重试 API
  - 只允许 failed 状态重试
  - 只重试单个平台
  - 保存新 request_id 和错误历史
  - _Requirements: US-4_

- [x] 11. 实现封面与发布信息 UI
  - 平台 tabs
  - 标题、标签、描述、话题编辑
  - 标题限制、标签数量、封面比例提示
  - _Requirements: US-1, US-3_

- [x] 12. 实现发布中心 UI
  - 展示账号授权状态
  - 展示发布参数检查
  - 支持定时发布、保存草稿、仅导出 MP4、一键发布
  - 展示发布日志
  - _Requirements: US-2, US-3, US-4_

- [x] 13. 添加测试
  - 平台草稿生成
  - 标题超长阻断发布
  - token 过期平台 skipped
  - 部分平台失败后可单独重试
  - _Requirements: US-1, US-2, US-3, US-4_

- [x] 14. Checkpoint: 发布辅助验收
  - 最终视频生成后可生成平台草稿
  - 授权状态和参数检查可见
  - 一键发布支持部分成功、失败原因和重试
  - _Requirements: US-1, US-2, US-3, US-4_

## 执行反馈

### Task 0: 后续开发规范检查与任务执行判断

### 任务
- Spec: `voflow-publish-assistant`
- Task: 0
- Requirements: US-1、US-2、US-3、US-4

### 修改文件
- `.kiro/specs/voflow-publish-assistant/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：读取并对照根目录 `AI_RULES.md`、`.kiro/plans/voflow-platform/plan.md`、`voflow-publish-assistant` 的 `requirements.md`、`design.md`、`tasks.md`，确认当前唯一开发入口已从 `voflow-packaging-export` 推进到 `voflow-publish-assistant`。
- 本次完成：确认 `voflow-packaging-export` checklist 已 17/17 完成，但 MVP 主线第 12 行仍因真实数字人模型、生产 FFmpeg subtitles filter、复杂剪辑 filter 联调缺口保持 `partial`；发布助手只能消费 final_video artifact 和发布元信息，不应回改包装导出链路。
- 本次完成：检索现有 publish 相关代码，确认当前只有 `/dashboard/publish` 占位页、workflow `publish` 节点定义、素材 usageScope `publishing` 和 reference 平台识别常量；尚无 `channel_accounts`、`publish_drafts`、`publishes` schema/service/API。
- 当前任务执行判断：Task 1 是下一个可执行任务，应先创建发布相关数据表和 Prisma enum/model/migration，并同步收口 platform/status 枚举；不要先做 UI、adapter 或 mock OAuth。
- 明确未完成：本轮未创建数据库表，未实现平台规则配置、发布草稿生成、草稿编辑 API、渠道账号状态、OAuth/mock account、参数检查、Channel Adapter、一键发布、失败重试、发布 UI 或 checkpoint。
- 是否使用 mock/provider/adapter 占位：本轮未新增运行时代码；后续 Task 6/8 若使用 mock channel account / mock adapter，必须在对应执行反馈中标明 mock 边界，不能按真实平台发布能力验收。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-10、`voflow-packaging-export` Task 0-16 的 schema/API/service/worker/UI/tests/Kiro 文档改动，以及 `docs/05-开发进度说明.md`、`prisma/schema.prisma`、`src/app/dashboard/voices/page.tsx`、`src/services/workflowWorkerService.ts` 等相关改动。
- 本任务实际改动：仅更新 `voflow-publish-assistant` Task 0 勾选和执行反馈，并同步总控 plan 和开发进度说明。
- 未触碰的既有改动：未修改 advanced-editing、packaging-export 的代码实现，未回滚前序 avatar render、TTS、voice clone 等改动。

### 硬编码检查
- 是否新增运行时硬编码：否，本轮只更新 Kiro 文档和开发进度说明。
- 新增配置是否收口：本轮未新增配置；后续平台列表、标题长度、标签数量、封面比例、视频时长限制、token 状态、发布状态、错误码和重试策略必须收口到 `src/lib/publish/*`、Prisma enum 或等价领域模块。
- 新增错误码/状态/枚举是否收口：本轮未新增；Task 1 应优先用 Prisma enum 收口 platform、channel account status、publish status。

### 公共化检查
- 复用的公共模块：`src/lib/api-response.ts`、`src/lib/api-auth.ts`、`src/lib/workflow/constants.ts`、`src/lib/workflow/status.ts`、`src/lib/assets/consent.ts`、`src/lib/references/platforms.ts`、`src/app/dashboard/publish/page.tsx` 当前占位入口。
- 新增的公共函数/service：无。
- 后续需要抽取的重复逻辑：Task 1-2 应新增 `src/lib/publish/constants.ts` 或等价模块；Task 3-4 应新增发布草稿 serializer/service；Task 5-8 应新增 token 加密 helper、channel account service、platform validator 和 channel adapter 接口；API route 不得直接拼平台规则或状态文案。

### 验证命令
- `rg -n "publish|channel|douyin|kuaishou|xiaohongshu|wechat_channels|bilibili|youtube_shorts|tiktok|CHANNEL_TOKEN|PUBLISH_" src prisma tests .kiro/specs/voflow-publish-assistant docs/05-开发进度说明.md`: 通过，确认现有 publish 运行时代码仍为占位，平台枚举主要存在于 reference 平台识别和 spec 文档中。
- `find src -maxdepth 4 -type d \( -name '*publish*' -o -name '*channel*' \) -print`: 通过，仅发现 `src/app/dashboard/publish`。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 0。
- 是否满足对应 Acceptance Criteria：满足进入 publish-assistant 前的规范检查、公共化边界确认和任务执行判断；US-1 到 US-4 的业务实现从 Task 1 开始。
- 是否允许勾选：允许勾选 Task 0，不允许勾选 Task 1-14。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 13/14 行仍为 `not_started`；证据更新为 publish-assistant 已完成启动规范检查，下一步进入数据表建模。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 0 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-publish-assistant` Task 1。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 1: 创建发布相关数据表

### 任务
- Spec: `voflow-publish-assistant`
- Task: 1
- Requirements: US-1、US-2、US-4

### 修改文件
- `prisma/schema.prisma`
- `prisma/migrations/20260625091000_add_publish_tables/migration.sql`
- `tests/publish-schema.test.ts`
- `.kiro/specs/voflow-publish-assistant/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `PublishPlatform`、`ChannelAccountStatus`、`PublishStatus` Prisma enum，用数据库 enum 收口发布平台、渠道账号状态和发布状态。
- 本次完成：新增 `channel_accounts` 表，保存 team/user/platform/accountName/encryptedToken/status/expiresAt，并关联 `teams`、`users`、`publishes`。
- 本次完成：新增 `publish_drafts` 表，保存 job/platform/title/description/tagsJson/topicsJson/coverArtifactId/validationJson，并保证同一个 job 每个平台只有一份草稿。
- 本次完成：新增 `publishes` 表，保存 job/publishDraft/channelAccount/platform/status/requestId/remoteId/errorJson，用于后续一键发布、失败记录和重试。
- 本次完成：新增 migration 并部署到本地 PostgreSQL，已生成 Prisma Client。
- 明确未完成：本轮不实现平台规则配置、发布信息生成、草稿编辑 API、OAuth/mock account、参数检查、Channel Adapter、一键发布、失败重试和发布 UI。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing`、`voflow-packaging-export` 的实现/测试/文档改动，以及 `prisma/schema.prisma` 中已有 export/editing 相关未提交内容。
- 本任务实际改动：仅新增 publish-assistant 的 schema、migration、schema test，并同步 Task 1 任务状态、总控 plan 和开发进度说明。
- 未触碰的既有改动：未回滚或重写 advanced-editing、packaging-export、voices page、workflow worker 等前序改动。

### 硬编码检查
- 是否新增运行时硬编码：否。本轮只新增数据库 enum/model/migration 和 schema 测试，未新增 API/Adapter/UI 运行时代码。
- 新增配置是否收口：platform、channel account status、publish status 已收口到 Prisma enum；后续平台标题长度、标签数量、封面比例、视频时长限制仍需在 Task 2 的公共配置模块中实现。
- 新增错误码/状态/枚举是否收口：已通过 Prisma enum 收口 `PublishPlatform`、`ChannelAccountStatus`、`PublishStatus`。

### 公共化检查
- 复用的公共模块：`@/lib/db` 用于 schema 验证测试；Prisma relation 复用现有 `User`、`Team`、`VideoJob`、`Artifact`。
- 新增的公共函数/service：无，Task 1 仅做数据层建模。
- 后续需要抽取的重复逻辑：Task 2 应新增 publish platform rules 公共模块；Task 3-4 应新增发布草稿 serializer/service；Task 5-8 应新增 token 加密 helper、channel account service、platform validator 和 channel adapter 接口。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-schema.test.ts`: 先 RED，6 个测试因表/enum/列/索引/外键缺失失败，符合 TDD 预期。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma format`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma validate`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma migrate deploy`: 通过，已应用 `20260625091000_add_publish_tables`。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma generate`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-schema.test.ts`: GREEN，1 个文件 6 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-schema.test.ts tests/export-request-schema.test.ts`: 通过，2 个文件 10 个测试通过。

### 验收结论
- 是否满足当前 task：满足 Task 1。
- 是否满足对应 Acceptance Criteria：满足 US-1 的平台独立草稿存储基础，US-2 的渠道账号/token 状态存储基础，US-4 的发布记录、状态和失败信息存储基础。
- 是否允许勾选：允许勾选 Task 1，不允许勾选 Task 2-14。
- MVP 状态矩阵是否需要同步更新：需要，publish-assistant 已从 1/15 推进到 2/15；第 13/14 行仍保持 `partial`，因为尚未实现平台规则、草稿生成、账号授权、发布检查、adapter、一键发布和 UI。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 1 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-publish-assistant` Task 2。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 2: 实现平台规则配置

### 任务
- Spec: `voflow-publish-assistant`
- Task: 2
- Requirements: US-1、US-3

### 修改文件
- `src/lib/publish/rules.ts`
- `tests/publish-platform-rules.test.ts`
- `.kiro/specs/voflow-publish-assistant/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `src/lib/publish/rules.ts`，集中维护 `douyin`、`kuaishou`、`xiaohongshu`、`wechat_channels`、`bilibili`、`youtube_shorts`、`tiktok` 的发布平台规则。
- 本次完成：配置每个平台的标题长度、标签数量、封面允许比例、推荐封面比例、视频最短/最长时长。
- 本次完成：新增 `PUBLISH_PLATFORMS`、`PUBLISH_PLATFORM_RULES`、`isPublishPlatform()`、`getPublishPlatformRule()`、`listPublishPlatformRules()` 和稳定领域错误 `PublishPlatformRuleError`。
- 本次完成：新增 focused unit test 覆盖平台顺序、规则完整性、抖音/YouTube Shorts/TikTok 关键边界值、未知平台稳定错误。
- 明确未完成：本轮不实现发布草稿生成、发布草稿编辑 API、账号授权状态、OAuth/mock account、发布参数检查 API、Channel Adapter、一键发布、失败重试和发布 UI。
- 是否使用 mock/provider/adapter 占位：否。本轮只新增配置模块和单元测试，没有新增 mock adapter 或真实平台 adapter。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing`、`voflow-packaging-export`、`voflow-publish-assistant` Task 0-1 的实现/测试/文档改动，以及 `src/app/dashboard/voices/page.tsx`、`src/services/workflowWorkerService.ts` 等前序改动。
- 本任务实际改动：新增 publish rules 公共模块和对应单元测试，并同步 Task 2 任务状态、总控 plan 和开发进度说明。
- 未触碰的既有改动：未回滚或重写 advanced-editing、packaging-export、Task 1 schema/migration、voices page、workflow worker 等前序改动。

### 硬编码检查
- 是否新增运行时硬编码：没有在 API、Adapter、Worker 或 UI 中新增散落硬编码；平台规则按 AI_RULES 要求集中收口到 `src/lib/publish/rules.ts`。
- 新增配置是否收口：是，标题长度、标签数量、封面比例和视频时长限制均收口到 `PUBLISH_PLATFORM_RULES`。
- 新增错误码/状态/枚举是否收口：新增 `PUBLISH_PLATFORM_UNSUPPORTED`，已收口到 `PUBLISH_PLATFORM_ERROR_CODES`。

### 公共化检查
- 复用的公共模块：沿用 Task 1 的 `PublishPlatform` 字符串口径和 Prisma enum 顺序；规则模块遵循现有 `src/lib/<domain>/constants|rules.ts` 风格。
- 新增的公共函数/service：新增 `isPublishPlatform()`、`getPublishPlatformRule()`、`listPublishPlatformRules()`。
- 后续需要抽取的重复逻辑：Task 3-4 应复用 `getPublishPlatformRule()` 生成和保存平台草稿；Task 7 的发布参数检查必须复用 `PUBLISH_PLATFORM_RULES`，不得重新维护平台规则。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-platform-rules.test.ts`: 先 RED，因 `@/lib/publish/rules` 缺失失败，符合 TDD 预期。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-platform-rules.test.ts`: GREEN，1 个文件 4 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-platform-rules.test.ts tests/publish-schema.test.ts`: 通过，2 个文件 10 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过，0 warning / 0 error。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/tsc --noEmit`: 未通过，失败点为既有测试类型问题，包括 `tests/avatar-detector.test.ts` 缺少 `vi` 导入、`tests/asset-consent.test.ts`/`tests/reference-api.test.ts`/`tests/reference-url-import-worker.test.ts` 的 Prisma JSON 输入类型不匹配、`tests/avatar-ui.test.tsx` fixture 缺少 `SerializedAsset` 字段、`tests/voice-clone-service.test.ts`/`tests/voice-trainer-service.test.ts` 的既有测试类型推断问题；本任务新增的 `src/lib/publish/rules.ts` 和 `tests/publish-platform-rules.test.ts` 未出现在错误列表中。

### 验收结论
- 是否满足当前 task：满足 Task 2。
- 是否满足对应 Acceptance Criteria：满足 US-1/AC2 和 US-3 发布前检查所需的平台规则配置基础；规则已可被后续 API/UI/validator 复用。
- 是否允许勾选：允许勾选 Task 2，不允许勾选 Task 3-14。
- MVP 状态矩阵是否需要同步更新：需要，publish-assistant 已从 2/15 推进到 3/15；第 13/14 行仍保持 `partial`，因为尚未实现平台草稿生成、账号授权、发布检查、adapter、一键发布和 UI。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 2 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-publish-assistant` Task 3。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 3: 实现发布信息生成

### 任务
- Spec: `voflow-publish-assistant`
- Task: 3
- Requirements: US-1

### 修改文件
- `src/services/publishDraftLlmProvider.ts`
- `src/services/publishDraftGenerationService.ts`
- `src/app/api/video-jobs/[jobId]/publish-drafts/generate/route.ts`
- `tests/publish-draft-llm-provider.test.ts`
- `tests/publish-draft-generation-service.test.ts`
- `tests/publish-drafts-generate-api.test.ts`
- `.kiro/specs/voflow-publish-assistant/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增本地 OpenAI-compatible 发布草稿 LLM provider，按平台规则构造 prompt，解析纯 JSON 或 fenced JSON 输出，生成 title、description、tags、topics。
- 本次完成：新增 `generatePublishDrafts()` service，从当前 team/job 读取已批准最终文案，调用本地 LLM provider，为目标平台生成独立草稿。
- 本次完成：生成结果会复用 `src/lib/publish/rules.ts`，按平台标题长度裁剪 title，按平台标签数量裁剪 tags，并 upsert 到 `publish_drafts`，确保同一个 job/platform 只有一份草稿。
- 本次完成：新增 `POST /api/video-jobs/[jobId]/publish-drafts/generate`，统一鉴权、Zod 校验请求体、调用生成 service，并映射 401/404/400/SUCCESS。
- 明确未完成：本轮不实现发布草稿查询/编辑 API、封面修改、账号授权状态、OAuth/mock account、发布参数检查 API、Channel Adapter、一键发布、失败重试和发布 UI。
- 是否使用 mock/provider/adapter 占位：运行时代码使用本地 OpenAI-compatible LLM provider；测试中使用 mock provider 隔离真实模型服务，不代表 mock 平台发布能力。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing`、`voflow-packaging-export`、`voflow-publish-assistant` Task 0-2 的实现/测试/文档改动，以及 `src/app/dashboard/voices/page.tsx`、`src/services/workflowWorkerService.ts` 等前序改动。
- 本任务实际改动：新增 publish draft LLM provider、publish draft generation service、generate API route 和对应 tests，并同步 Task 3 任务状态、总控 plan 和开发进度说明。
- 未触碰的既有改动：未回滚或重写 advanced-editing、packaging-export、Task 1 schema/migration、Task 2 rules、voices page、workflow worker 等前序改动。

### 硬编码检查
- 是否新增运行时硬编码：未在 API、Worker 或 UI 散写平台规则；LLM 服务地址和模型名复用 `getScriptAiModelRegistry()` / `requireAvailableLlmService()` 从 `local_model_services.llm` 和现有 generation config 读取。
- 新增配置是否收口：发布平台规则继续复用 `src/lib/publish/rules.ts`；请求体平台枚举复用 `PUBLISH_PLATFORMS`；本地 LLM provider 类型复用现有 `LocalLlmServiceConfig`。
- 新增错误码/状态/枚举是否收口：新增 service/domain 错误码 `PUBLISH_JOB_NOT_FOUND`、`PUBLISH_SCRIPT_NOT_READY`、`PUBLISH_PLATFORM_UNSUPPORTED`，新增 provider 错误码 `PUBLISH_DRAFT_LLM_REQUEST_FAILED`、`PUBLISH_DRAFT_LLM_INVALID_RESPONSE`，均收口在 publish draft service/provider 文件内；未新增 Prisma enum。

### 公共化检查
- 复用的公共模块：`src/lib/api-auth.ts`、`src/lib/api-response.ts`、`src/lib/publish/rules.ts`、`src/services/scriptModelRegistryService.ts`、`src/services/scriptLlmProvider.ts` 的 `LocalLlmServiceConfig`。
- 新增的公共函数/service：新增 `createLocalPublishDraftLlmProvider()`、`generatePublishDrafts()`。
- 后续需要抽取的重复逻辑：Task 4 查询/编辑 API 应复用 publish draft serializer 口径；Task 7 参数检查必须复用 `PUBLISH_PLATFORM_RULES` 和 `publish_drafts.validationJson`。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-draft-generation-service.test.ts`: 先 RED，因 `@/services/publishDraftGenerationService` 缺失失败；实现后 GREEN，1 个文件 4 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-draft-llm-provider.test.ts`: 先 RED，因 provider 不能解析 fenced JSON 失败；补充解析后 GREEN，1 个文件 1 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-drafts-generate-api.test.ts`: 先 RED，因 route 缺失失败；实现后 GREEN，1 个文件 4 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-schema.test.ts tests/publish-platform-rules.test.ts tests/publish-draft-llm-provider.test.ts tests/publish-draft-generation-service.test.ts tests/publish-drafts-generate-api.test.ts`: 通过，5 个文件 19 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过，0 warning / 0 error。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过，新 route `/api/video-jobs/[jobId]/publish-drafts/generate` 出现在 build route 列表中。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/tsc --noEmit`: 未通过，剩余失败点为既有测试类型问题，包括 `tests/avatar-detector.test.ts` 缺少 `vi` 导入、`tests/asset-consent.test.ts`/`tests/reference-api.test.ts`/`tests/reference-url-import-worker.test.ts` 的 Prisma JSON 输入类型不匹配、`tests/avatar-ui.test.tsx` fixture 缺少 `SerializedAsset` 字段、`tests/voice-clone-service.test.ts`/`tests/voice-trainer-service.test.ts` 的既有测试类型推断问题；本轮新增文件不再出现在错误列表中。

### 验收结论
- 是否满足当前 task：满足 Task 3。
- 是否满足对应 Acceptance Criteria：满足 US-1/AC1 的生成基础和 US-1/AC3 的平台独立草稿保存基础；平台限制复用 Task 2 rules，后续 UI/API 查询编辑继续消费 `publish_drafts`。
- 是否允许勾选：允许勾选 Task 3，不允许勾选 Task 4-14。
- MVP 状态矩阵是否需要同步更新：需要，publish-assistant 已从 3/15 推进到 4/15；第 13/14 行仍保持 `partial`，因为尚未实现草稿查询/编辑、账号授权、发布检查、adapter、一键发布、失败重试和 UI。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 3 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-publish-assistant` Task 4。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 4: 实现发布草稿编辑 API

### 任务
- Spec: `voflow-publish-assistant`
- Task: 4
- Requirements: US-1

### 修改文件
- `src/lib/publish/serializer.ts`
- `src/services/publishDraftService.ts`
- `src/services/publishDraftGenerationService.ts`
- `src/app/api/video-jobs/[jobId]/publish-drafts/route.ts`
- `src/app/api/publish-drafts/[draftId]/route.ts`
- `tests/publish-drafts-api.test.ts`
- `.kiro/specs/voflow-publish-assistant/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `GET /api/video-jobs/[jobId]/publish-drafts`，按当前 session team 查询指定 video job 的平台草稿列表。
- 本次完成：新增 `PUT /api/publish-drafts/[draftId]`，支持修改 title、description、tags、topics、coverArtifactId，并保存为平台独立草稿。
- 本次完成：新增 `src/lib/publish/serializer.ts`，统一输出发布草稿的 tags/topics、coverArtifactId、validationJson、平台规则和时间字段，避免 route 直接映射 JSON/Date。
- 本次完成：新增 `src/services/publishDraftService.ts`，集中处理 team 归属、draft 查询、title/tag 平台规则校验、封面 artifact 同 job/type 校验、编辑后清空 stale validationJson。
- 本次完成：`publishDraftGenerationService` 改为复用同一个 serializer，确保 Task 3 生成 API 和 Task 4 查询/编辑 API 的输出口径一致。
- 明确未完成：本轮不实现渠道账号状态、OAuth/mock account、发布参数检查、Channel Adapter、一键发布、失败重试和发布 UI。
- 是否使用 mock/provider/adapter 占位：否。本轮只实现真实 DB/API/service 逻辑；测试使用本地数据库 fixture，不新增 mock channel adapter。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing`、`voflow-packaging-export`、`voflow-publish-assistant` Task 0-3 的实现/测试/文档改动，以及 `src/app/dashboard/voices/page.tsx`、`src/services/workflowWorkerService.ts` 等前序改动。
- 本任务实际改动：新增 publish draft serializer/service、GET/PUT API route、Task 4 API 测试，并同步 Task 4 任务状态、总控 plan 和开发进度说明。
- 未触碰的既有改动：未回滚或重写 advanced-editing、packaging-export、Task 1 schema/migration、Task 2 rules、Task 3 LLM provider/generate API、voices page、workflow worker 等前序改动。

### 硬编码检查
- 是否新增运行时硬编码：未在 API 或 UI 散写平台规则；标题长度和标签数量校验复用 `src/lib/publish/rules.ts`。
- 新增配置是否收口：本轮未新增环境配置；平台规则继续收口到 `PUBLISH_PLATFORM_RULES`。
- 新增错误码/状态/枚举是否收口：新增 `PUBLISH_DRAFT_NOT_FOUND`、`PUBLISH_DRAFT_TITLE_TOO_LONG`、`PUBLISH_DRAFT_TAGS_TOO_MANY`、`PUBLISH_DRAFT_COVER_NOT_FOUND`，已收口到 `src/services/publishDraftService.ts` 的 `PUBLISH_DRAFT_ERROR_CODES`；未新增 Prisma enum。

### 公共化检查
- 复用的公共模块：`src/lib/api-auth.ts`、`src/lib/api-response.ts`、`src/lib/publish/rules.ts`。
- 新增的公共函数/service：新增 `serializePublishDraft()`、`readStringArray()`、`getPublishDraftsForJob()`、`updatePublishDraft()`。
- 后续需要抽取的重复逻辑：Task 7 发布参数检查应继续复用 `serializePublishDraft()` 和 `PUBLISH_PLATFORM_RULES`；Task 11 UI 应消费 GET API 返回的 rule 字段，不要在页面重复维护平台规则。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-drafts-api.test.ts`: 先 RED，因 `@/app/api/video-jobs/[jobId]/publish-drafts/route` 缺失失败；实现后 GREEN，1 个文件 6 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-schema.test.ts tests/publish-platform-rules.test.ts tests/publish-draft-llm-provider.test.ts tests/publish-draft-generation-service.test.ts tests/publish-drafts-generate-api.test.ts tests/publish-drafts-api.test.ts`: 通过，6 个文件 25 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过，0 warning / 0 error。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过，新 route `/api/video-jobs/[jobId]/publish-drafts` 和 `/api/publish-drafts/[draftId]` 出现在 build route 列表中。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/tsc --noEmit`: 未通过，剩余失败点为既有测试类型问题，包括 `tests/avatar-detector.test.ts` 缺少 `vi` 导入、`tests/asset-consent.test.ts`/`tests/reference-api.test.ts`/`tests/reference-url-import-worker.test.ts` 的 Prisma JSON 输入类型不匹配、`tests/avatar-ui.test.tsx` fixture 缺少 `SerializedAsset` 字段、`tests/voice-clone-service.test.ts`/`tests/voice-trainer-service.test.ts` 的既有测试类型推断问题；本轮新增 Task 4 文件未出现在错误列表中。

### 验收结论
- 是否满足当前 task：满足 Task 4。
- 是否满足对应 Acceptance Criteria：满足 US-1/AC3，用户修改发布信息后系统可保存平台独立草稿；查询 API 可返回平台规则供后续 UI 展示标题/标签限制。
- 是否允许勾选：允许勾选 Task 4，不允许勾选 Task 5-14。
- MVP 状态矩阵是否需要同步更新：需要，publish-assistant 已从 4/15 推进到 5/15；第 13 行仍保持 `partial`，因为发布信息 UI 尚未完成；第 14 行仍保持 `partial`，因为尚未实现账号授权、发布检查、adapter、一键发布和重试。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 4 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-publish-assistant` Task 5。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 5: 实现渠道账号模型和状态展示

### 任务
- Spec: `voflow-publish-assistant`
- Task: 5
- Requirements: US-2

### 修改文件
- `.env.example`
- `src/lib/publish/token.ts`
- `src/lib/publish/channel-account.ts`
- `src/services/channelAccountService.ts`
- `src/app/api/channel-accounts/route.ts`
- `tests/channel-token.test.ts`
- `tests/channel-accounts-api.test.ts`
- `.kiro/specs/voflow-publish-assistant/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `GET /api/channel-accounts`，按当前 session 的 team/user 返回所有发布平台的渠道账号展示状态。
- 本次完成：缺失账号按 `not_connected` 返回；DB 中 `connected` 但 `expiresAt` 已过期时展示为 `expired`；`revoked` 账号展示为 `not_connected`，避免 UI 额外散写状态转换。
- 本次完成：返回账号昵称、过期时间、平台 label、状态 label、是否需要重新授权；响应不包含 `encryptedToken`。
- 本次完成：新增 `src/lib/publish/token.ts`，使用 AES-256-GCM 保存渠道 token，缺少 `CHANNEL_TOKEN_ENCRYPTION_SECRET` 时 fail fast，不使用默认密钥。
- 本次完成：新增 `saveChannelAccountToken()` service，为 Task 6 的 OAuth/mock 授权接口提供加密落库能力。
- 明确未完成：本轮不实现 OAuth/授权占位接口、不创建 mock channel account、不实现 Channel Adapter、一键发布、失败重试或发布 UI。
- 是否使用 mock/provider/adapter 占位：否。本轮没有新增 mock adapter；测试中的 token 字符串和账号记录是数据库 fixture。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing`、`voflow-packaging-export`、`voflow-publish-assistant` Task 0-4 的实现/测试/文档改动，以及 `src/app/dashboard/voices/page.tsx`、`src/services/workflowWorkerService.ts` 等前序改动。
- 本任务实际改动：新增 channel account token helper、状态 serializer/service、GET API route、Task 5 focused tests 和 `.env.example` 配置示例，并同步 Task 5 任务状态、总控 plan 和开发进度说明。
- 未触碰的既有改动：未回滚或重写 advanced-editing、packaging-export、Task 1 schema/migration、Task 2 rules、Task 3 草稿生成、Task 4 草稿查询/编辑、voices page、workflow worker 等前序改动。

### 硬编码检查
- 是否新增运行时硬编码：未在 API、Adapter 或 UI 散写 token 状态文案；渠道账号展示状态和 label 收口到 `src/lib/publish/channel-account.ts`。
- 新增配置是否收口：新增 `CHANNEL_TOKEN_ENCRYPTION_SECRET`，已收口到 `src/lib/publish/token.ts` 的 `requireChannelTokenSecret()`，并写入 `.env.example`；缺失时 fail fast。
- 新增错误码/状态/枚举是否收口：新增 `CHANNEL_TOKEN_SECRET_MISSING`、`CHANNEL_TOKEN_INVALID_PAYLOAD`，已收口到 `src/lib/publish/token.ts`；未新增 Prisma enum。

### 公共化检查
- 复用的公共模块：`src/lib/api-auth.ts`、`src/lib/api-response.ts`、`src/lib/publish/rules.ts`。
- 新增的公共函数/service：新增 `encryptChannelToken()`、`decryptChannelToken()`、`isEncryptedChannelToken()`、`requireChannelTokenSecret()`、`serializeChannelAccount()`、`getChannelAccountDisplayStatus()`、`getChannelAccountsForUser()`、`saveChannelAccountToken()`。
- 后续需要抽取的重复逻辑：Task 6 OAuth/mock account 应复用 `saveChannelAccountToken()`，Task 7 发布参数检查应复用 `getChannelAccountsForUser()` 或 `getChannelAccountDisplayStatus()`，不要在 validator/UI 重写过期判断。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/channel-token.test.ts tests/channel-accounts-api.test.ts`: 先 RED，因 `@/lib/publish/token` 和 `@/app/api/channel-accounts/route` 缺失失败；实现后 GREEN，2 个文件 4 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-schema.test.ts tests/publish-platform-rules.test.ts tests/publish-draft-llm-provider.test.ts tests/publish-draft-generation-service.test.ts tests/publish-drafts-generate-api.test.ts tests/publish-drafts-api.test.ts tests/channel-token.test.ts tests/channel-accounts-api.test.ts`: 通过，8 个文件 29 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过，0 warning / 0 error。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过，新 route `/api/channel-accounts` 出现在 build route 列表中。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/tsc --noEmit`: 未通过，剩余失败点为既有测试类型问题，包括 `tests/avatar-detector.test.ts` 缺少 `vi` 导入、`tests/asset-consent.test.ts`/`tests/reference-api.test.ts`/`tests/reference-url-import-worker.test.ts` 的 Prisma JSON 输入类型不匹配、`tests/avatar-ui.test.tsx` fixture 缺少 `SerializedAsset` 字段、`tests/voice-clone-service.test.ts`/`tests/voice-trainer-service.test.ts` 的既有测试类型推断问题；本轮新增 Task 5 文件已不在错误列表中。

### 验收结论
- 是否满足当前 task：满足 Task 5。
- 是否满足对应 Acceptance Criteria：满足 US-2/AC1、US-2/AC2、US-2/AC3 的后端数据和状态展示基础；GET API 可返回 connected、expired、not_connected 及账号昵称/过期时间。
- 是否允许勾选：允许勾选 Task 5，不允许勾选 Task 6-14。
- MVP 状态矩阵是否需要同步更新：需要，publish-assistant 已从 5/15 推进到 6/15；第 14 行仍保持 `partial`，因为 OAuth/mock account、发布参数检查、adapter、一键发布、重试和发布 UI 尚未完成。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 5 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-publish-assistant` Task 6。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 6: 实现 OAuth/授权占位接口

### 任务
- Spec: `voflow-publish-assistant`
- Task: 6
- Requirements: US-2

### 修改文件
- `src/lib/publish/oauth.ts`
- `src/services/channelOAuthService.ts`
- `src/services/channelAccountService.ts`
- `src/app/api/channel-accounts/[platform]/authorize/route.ts`
- `src/app/api/channel-accounts/[platform]/mock-authorize/route.ts`
- `tests/channel-oauth-api.test.ts`
- `.kiro/specs/voflow-publish-assistant/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `GET /api/channel-accounts/[platform]/authorize`，按平台返回授权入口占位信息，包括平台 label、provider、mock 状态、授权 URL 和重新授权 URL。
- 本次完成：新增 `POST /api/channel-accounts/[platform]/mock-authorize`，为当前 session 的 team/user 创建或覆盖 mock channel account，并复用 `saveChannelAccountToken()` 加密保存 mock token。
- 本次完成：新增 `src/lib/publish/oauth.ts`，集中维护 mock OAuth provider、授权状态、mock 授权有效期边界和 `ChannelOAuthAdapter` 接口占位。
- 本次完成：新增 `mockAuthorizeChannelAccount()` service，平台校验复用 `isPublishPlatform()`，账号昵称默认复用平台规则 label，token 过期时间按统一边界生成。
- 本次完成：token 密钥仍通过 `CHANNEL_TOKEN_ENCRYPTION_SECRET` fail fast；route 不直接保存明文 token，不直接拼平台规则。
- 明确未完成：本轮不实现真实平台 OAuth、不调用真实开放平台、不实现 upload/publish/getStatus Channel Adapter、一键发布、失败重试、发布参数检查或发布 UI。
- 是否使用 mock/provider/adapter 占位：是。本轮只实现 mock OAuth 占位和 mock channel account 创建能力，`provider` 明确返回 `mock`，并保留 `ChannelOAuthAdapter` 接口；不得按真实平台授权能力验收。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing`、`voflow-packaging-export`、`voflow-publish-assistant` Task 0-5 的实现/测试/文档改动，以及 `src/app/dashboard/voices/page.tsx`、`src/services/workflowWorkerService.ts` 等前序改动。
- 本任务实际改动：新增 OAuth/mock 授权公共模块、service、两个 API route、Task 6 focused tests，并同步 Task 6 任务状态、总控 plan 和开发进度说明。
- 未触碰的既有改动：未回滚或重写 advanced-editing、packaging-export、Task 1 schema/migration、Task 2 rules、Task 3 草稿生成、Task 4 草稿查询/编辑、Task 5 渠道账号状态展示、voices page、workflow worker 等前序改动。

### 硬编码检查
- 是否新增运行时硬编码：未在 API route 散写平台列表、平台文案、token 状态或错误码；mock provider/status/path 和授权有效期边界收口到 `src/lib/publish/oauth.ts`。
- 新增配置是否收口：未新增 env；继续复用 `CHANNEL_TOKEN_ENCRYPTION_SECRET` 和 `src/lib/publish/token.ts`。
- 新增错误码/状态/枚举是否收口：平台错误继续复用 `PUBLISH_PLATFORM_UNSUPPORTED`；token 密钥错误继续复用 `CHANNEL_TOKEN_SECRET_MISSING`；mock provider/status 收口到 `CHANNEL_OAUTH_PROVIDER_TYPES` 和 `CHANNEL_OAUTH_STATUS`。

### 公共化检查
- 复用的公共模块：`src/lib/api-auth.ts`、`src/lib/api-response.ts`、`src/lib/publish/rules.ts`、`src/lib/publish/token.ts`、`src/lib/publish/channel-account.ts`、`src/services/channelAccountService.ts`。
- 新增的公共函数/service：新增 `serializeMockChannelAuthorization()`、`buildMockAuthorizePath()`、`mockChannelOAuthAdapter`、`getChannelAuthorizationEntry()`、`mockAuthorizeChannelAccount()`。
- 后续需要抽取的重复逻辑：Task 7 发布参数检查应复用 `getChannelAccountsForUser()`/channel account serializer 判定账号状态；Task 8 应在当前 OAuth adapter 边界基础上新增 `uploadVideo`、`publish`、`getStatus`、`retry` 的 Channel Adapter，不要把 mock OAuth 当成发布 adapter。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/channel-oauth-api.test.ts`: 先 RED，因 `@/app/api/channel-accounts/[platform]/authorize/route` 缺失失败；实现后 GREEN，1 个文件 5 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-schema.test.ts tests/publish-platform-rules.test.ts tests/publish-draft-llm-provider.test.ts tests/publish-draft-generation-service.test.ts tests/publish-drafts-generate-api.test.ts tests/publish-drafts-api.test.ts tests/channel-token.test.ts tests/channel-accounts-api.test.ts tests/channel-oauth-api.test.ts`: 通过，9 个文件 34 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过，0 warning / 0 error。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过，新 routes `/api/channel-accounts/[platform]/authorize` 和 `/api/channel-accounts/[platform]/mock-authorize` 出现在 build route 列表中。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/tsc --noEmit`: 未通过，剩余失败点为既有测试类型问题，包括 `tests/avatar-detector.test.ts` 缺少 `vi` 导入、`tests/asset-consent.test.ts`/`tests/reference-api.test.ts`/`tests/reference-url-import-worker.test.ts` 的 Prisma JSON 输入类型不匹配、`tests/avatar-ui.test.tsx` fixture 缺少 `SerializedAsset` 字段、`tests/voice-clone-service.test.ts`/`tests/voice-trainer-service.test.ts` 的既有测试类型推断问题；本轮新增 Task 6 文件已不在错误列表中。

### 验收结论
- 是否满足当前 task：满足 Task 6。
- 是否满足对应 Acceptance Criteria：满足 US-2/AC1、US-2/AC2、US-2/AC3 的授权占位和重新授权入口基础；mock 授权可创建 connected account，过期账号可通过同一 mock 授权入口覆盖为 connected。
- 是否允许勾选：允许勾选 Task 6，不允许勾选 Task 7-14。
- MVP 状态矩阵是否需要同步更新：需要，publish-assistant 已从 6/15 推进到 7/15；第 14 行仍保持 `partial`，因为发布参数检查、发布 Channel Adapter、一键发布、重试和发布 UI 尚未完成。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 6 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-publish-assistant` Task 7。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 7: 实现发布参数检查

### 任务
- Spec: `voflow-publish-assistant`
- Task: 7
- Requirements: US-3

### 修改文件
- `src/lib/publish/rules.ts`
- `src/lib/publish/validation.ts`
- `src/services/publishValidationService.ts`
- `src/app/api/video-jobs/[jobId]/publish/validate/route.ts`
- `tests/publish-validate-api.test.ts`
- `.kiro/specs/voflow-publish-assistant/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `POST /api/video-jobs/[jobId]/publish/validate`，支持按请求的 `platforms` 执行发布前参数检查。
- 本次完成：新增 `src/lib/publish/validation.ts`，集中维护 `PUBLISH_VALIDATION_FAILED`、`CHANNEL_TOKEN_EXPIRED`、`CHANNEL_ACCOUNT_NOT_CONNECTED`、标题/标签/封面/最终视频等检查码和 validation payload 类型。
- 本次完成：新增 `validatePublishParameters()` service，校验标题长度、标签数量、封面比例、最终视频是否存在、视频比例、视频时长和渠道账号授权状态。
- 本次完成：检查结果会写回对应 `publish_drafts.validationJson`，为后续一键发布 API 提供稳定前置条件。
- 本次完成：扩展 `src/lib/publish/rules.ts` 的 `video.allowedAspectRatios`，视频比例规则继续收口在平台规则模块中，validator 不散写平台比例。
- 明确未完成：本轮不实现 Channel Adapter、上传/发布/状态查询、发布任务创建、一键发布、失败重试或发布 UI。
- 是否使用 mock/provider/adapter 占位：否。本轮新增的是真实 DB/API/service 校验逻辑；测试使用本地数据库 fixture，不新增发布 adapter。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing`、`voflow-packaging-export`、`voflow-publish-assistant` Task 0-6 的实现/测试/文档改动，以及 `src/app/dashboard/voices/page.tsx`、`src/services/workflowWorkerService.ts` 等前序改动。
- 本任务实际改动：新增发布参数检查公共类型、service、API route、Task 7 focused tests，并同步 Task 7 任务状态、总控 plan 和开发进度说明。
- 未触碰的既有改动：未回滚或重写 advanced-editing、packaging-export、Task 1 schema/migration、Task 2 rules 基础配置、Task 3 草稿生成、Task 4 草稿查询/编辑、Task 5 渠道账号状态展示、Task 6 OAuth/mock 授权占位、voices page、workflow worker 等前序改动。

### 硬编码检查
- 是否新增运行时硬编码：未在 API route 或 validator 散写平台列表、标题长度、标签数量、封面比例、视频比例、视频时长或账号状态文案；平台限制复用 `src/lib/publish/rules.ts`，检查码收口到 `src/lib/publish/validation.ts`。
- 新增配置是否收口：新增 `video.allowedAspectRatios` 已收口到 `PUBLISH_PLATFORM_RULES`；本轮未新增 env。
- 新增错误码/状态/枚举是否收口：新增发布检查相关 code 已收口到 `PUBLISH_VALIDATION_ERROR_CODES` 和 `PUBLISH_VALIDATION_CHECK_CODES`；未新增 Prisma enum。

### 公共化检查
- 复用的公共模块：`src/lib/api-auth.ts`、`src/lib/api-response.ts`、`src/lib/publish/rules.ts`、`src/lib/publish/serializer.ts`、`src/lib/publish/channel-account.ts`、`src/services/channelAccountService.ts`。
- 新增的公共函数/service：新增 `validatePublishParameters()`，以及 `PublishValidationPayload` / `PublishPlatformValidationResult` / `PublishValidationCheck` 类型。
- 后续需要抽取的重复逻辑：Task 8 Channel Adapter 应消费 `publish_drafts.validationJson` 和当前 validation check code，不要在 adapter 中重新检查标题、标签、封面、视频和账号状态。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-validate-api.test.ts`: 先 RED，因 `@/app/api/video-jobs/[jobId]/publish/validate/route` 缺失失败；实现后 GREEN，1 个文件 4 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-schema.test.ts tests/publish-platform-rules.test.ts tests/publish-draft-llm-provider.test.ts tests/publish-draft-generation-service.test.ts tests/publish-drafts-generate-api.test.ts tests/publish-drafts-api.test.ts tests/channel-token.test.ts tests/channel-accounts-api.test.ts tests/channel-oauth-api.test.ts tests/publish-validate-api.test.ts`: 通过，10 个文件 38 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过，0 warning / 0 error。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过，新 route `/api/video-jobs/[jobId]/publish/validate` 出现在 build route 列表中。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/tsc --noEmit`: 未通过，剩余失败点为既有测试类型问题，包括 `tests/avatar-detector.test.ts` 缺少 `vi` 导入、`tests/asset-consent.test.ts`/`tests/reference-api.test.ts`/`tests/reference-url-import-worker.test.ts` 的 Prisma JSON 输入类型不匹配、`tests/avatar-ui.test.tsx` fixture 缺少 `SerializedAsset` 字段、`tests/voice-clone-service.test.ts`/`tests/voice-trainer-service.test.ts` 的既有测试类型推断问题；本轮新增 Task 7 文件已不在错误列表中。

### 验收结论
- 是否满足当前 task：满足 Task 7。
- 是否满足对应 Acceptance Criteria：满足 US-3/AC1 和 US-3/AC2；发布前检查可校验视频比例、标题长度、标签数量、封面比例/尺寸元数据和授权状态，失败时返回 `PUBLISH_VALIDATION_FAILED` 并展示逐项原因。
- 是否允许勾选：允许勾选 Task 7，不允许勾选 Task 8-14。
- MVP 状态矩阵是否需要同步更新：需要，publish-assistant 已从 7/15 推进到 8/15；第 14 行仍保持 `partial`，因为发布 Channel Adapter、一键发布、重试和发布 UI 尚未完成。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 7 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-publish-assistant` Task 8。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 8: 实现 Channel Adapter 接口

### 任务
- Spec: `voflow-publish-assistant`
- Task: 8
- Requirements: US-4

### 修改文件
- `src/lib/publish/channel-adapter.ts`
- `tests/publish-channel-adapter.test.ts`
- `.kiro/specs/voflow-publish-assistant/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `PublishChannelAdapter` 接口，包含 `uploadVideo()`、`publish()`、`getStatus()`、`retry()` 四个方法。
- 本次完成：新增 `createMockChannelAdapter()` 和 `getChannelAdapter()`，当前统一返回 mock adapter，为后续真实平台 adapter 保留统一接口边界。
- 本次完成：mock adapter 消费已通过的 `validationJson`、final video artifact id、channel account id、草稿标题/标签/封面等发布输入，并返回稳定的 mock request id、remote video id、remote publish id 和 published 状态。
- 本次完成：新增 `PUBLISH_ADAPTER_ERROR_CODES`，收口 `PUBLISH_VALIDATION_FAILED`、`PUBLISH_UPLOAD_FAILED`、`PUBLISH_REMOTE_FAILED` 等 Adapter 层错误码。
- 明确未完成：本轮不创建 publish 任务、不写入 `publishes`、不实现一键发布 API、不实现失败重试 API、不实现真实开放平台上传/发布/状态查询、不实现发布 UI。
- 是否使用 mock/provider/adapter 占位：是。本轮只实现 mock channel adapter 和可插拔接口，不能按真实平台发布能力验收。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing`、`voflow-packaging-export`、`voflow-publish-assistant` Task 0-7 的实现/测试/文档改动，以及 `src/app/dashboard/voices/page.tsx`、`src/services/workflowWorkerService.ts` 等前序改动。
- 本任务实际改动：新增 channel adapter 公共模块、mock adapter、Task 8 focused tests，并同步 Task 8 任务状态、总控 plan 和开发进度说明。
- 未触碰的既有改动：未回滚或重写 advanced-editing、packaging-export、Task 1 schema/migration、Task 2 rules、Task 3 草稿生成、Task 4 草稿查询/编辑、Task 5 渠道账号状态展示、Task 6 OAuth/mock 授权占位、Task 7 发布参数检查、voices page、workflow worker 等前序改动。

### 硬编码检查
- 是否新增运行时硬编码：未在 API、Worker 或 UI 散写平台规则、发布状态文案或错误码；Adapter provider、remote status 和错误码收口到 `src/lib/publish/channel-adapter.ts`。
- 新增配置是否收口：本轮未新增 env；mock adapter 不读取外部服务地址、密钥或平台开放接口。
- 新增错误码/状态/枚举是否收口：新增 `PUBLISH_ADAPTER_ERROR_CODES`、`PUBLISH_ADAPTER_REMOTE_STATUSES`、`PUBLISH_CHANNEL_ADAPTER_PROVIDERS`，均收口在 channel adapter 公共模块；未新增 Prisma enum。

### 公共化检查
- 复用的公共模块：`src/lib/publish/rules.ts`、`src/lib/publish/validation.ts`。
- 新增的公共函数/service：新增 `getChannelAdapter()`、`createMockChannelAdapter()`、`isSuccessfulAdapterResult()` 和 `PublishChannelAdapter` 相关类型。
- 后续需要抽取的重复逻辑：Task 9 一键发布 API 应复用 `getChannelAdapter()` 和 Adapter result 类型，不要在 publish API 中手写 mock request id、remote id 或发布状态映射；Task 10 重试 API 应复用 `adapter.retry()`。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-channel-adapter.test.ts`: 先 RED，因 `@/lib/publish/channel-adapter` 缺失失败；实现后 GREEN，1 个文件 4 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-schema.test.ts tests/publish-platform-rules.test.ts tests/publish-draft-llm-provider.test.ts tests/publish-draft-generation-service.test.ts tests/publish-drafts-generate-api.test.ts tests/publish-drafts-api.test.ts tests/channel-token.test.ts tests/channel-accounts-api.test.ts tests/channel-oauth-api.test.ts tests/publish-validate-api.test.ts tests/publish-channel-adapter.test.ts`: 通过，11 个文件 42 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过，0 warning / 0 error。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/tsc --noEmit`: 未通过，剩余失败点为既有测试类型问题，包括 `tests/avatar-detector.test.ts` 缺少 `vi` 导入、`tests/asset-consent.test.ts`/`tests/reference-api.test.ts`/`tests/reference-url-import-worker.test.ts` 的 Prisma JSON 输入类型不匹配、`tests/avatar-ui.test.tsx` fixture 缺少 `SerializedAsset` 字段、`tests/voice-clone-service.test.ts`/`tests/voice-trainer-service.test.ts` 的既有测试类型推断问题；本轮新增 Task 8 文件已不在错误列表中。

### 验收结论
- 是否满足当前 task：满足 Task 8。
- 是否满足对应 Acceptance Criteria：满足 US-4 后续一键发布/状态查询/重试所需的 Adapter 边界基础；mock adapter 已覆盖上传、发布、查询状态和重试四个方法。
- 是否允许勾选：允许勾选 Task 8，不允许勾选 Task 9-14。
- MVP 状态矩阵是否需要同步更新：需要，publish-assistant 已从 8/15 推进到 9/15；第 14 行仍保持 `partial`，因为一键发布 API、失败重试 API 和发布 UI 尚未完成，且当前 adapter 仍是 mock。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 8 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-publish-assistant` Task 9。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 9: 实现一键发布 API

### 任务
- Spec: `voflow-publish-assistant`
- Task: 9
- Requirements: US-4

### 修改文件
- `src/lib/publish/publish.ts`
- `src/services/publishService.ts`
- `src/app/api/video-jobs/[jobId]/publish/route.ts`
- `tests/publish-api.test.ts`
- `.kiro/specs/voflow-publish-assistant/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `POST /api/video-jobs/[jobId]/publish`，支持按请求 `platforms` 创建一键发布记录。
- 本次完成：新增 `createPublishesForJob()` service，按 job/team 校验资源归属，读取平台草稿、`publish_drafts.validationJson`、渠道账号和最终视频 artifact。
- 本次完成：对 `validationJson.passed === true` 且 channel account 当前展示状态为 `connected` 的平台，复用 `getChannelAdapter()` 执行 `uploadVideo()` 和 `publish()`，并将 adapter 返回的 `requestId`、`remotePublishId` 保存到 `publishes.requestId`、`publishes.remoteId`。
- 本次完成：对 `expired` 或 `not_connected` 平台创建 `skipped` 发布记录，保存稳定原因 `CHANNEL_TOKEN_EXPIRED` 或 `CHANNEL_ACCOUNT_NOT_CONNECTED`；缺失账号会创建 `not_connected` channel account 以满足 `publishes.channelAccountId` 外键。
- 本次完成：新增发布记录 serializer、summary 和 validation snapshot 读取 helper，route 只保留鉴权、请求体验证和错误映射。
- 明确未完成：本轮不实现失败重试 API、不实现真实开放平台发布、不实现发布状态轮询 Worker、不实现发布 UI。
- 是否使用 mock/provider/adapter 占位：是。一键发布 API 当前通过 Task 8 的 mock channel adapter 完成上传/发布模拟，不能按真实平台发布能力验收。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing`、`voflow-packaging-export`、`voflow-publish-assistant` Task 0-8 的实现/测试/文档改动，以及 `src/app/dashboard/voices/page.tsx`、`src/services/workflowWorkerService.ts` 等前序改动。
- 本任务实际改动：新增 publish 公共 serializer/helper、一键发布 service、POST API route、Task 9 focused tests，并同步 Task 9 任务状态、总控 plan 和开发进度说明。
- 未触碰的既有改动：未回滚或重写 advanced-editing、packaging-export、Task 1 schema/migration、Task 2 rules、Task 3 草稿生成、Task 4 草稿查询/编辑、Task 5 渠道账号状态展示、Task 6 OAuth/mock 授权占位、Task 7 发布参数检查、Task 8 Channel Adapter、voices page、workflow worker 等前序改动。

### 硬编码检查
- 是否新增运行时硬编码：未在 API route 散写平台列表、发布状态文案、adapter request id 或账号状态判断；平台列表复用 `PUBLISH_PLATFORMS`，adapter request id 由 mock adapter 生成，发布错误/跳过码收口到 `src/lib/publish/publish.ts`。
- 新增配置是否收口：本轮未新增 env；继续复用已有 channel account、validation 和 adapter 公共模块。
- 新增错误码/状态/枚举是否收口：新增 `PUBLISH_ERROR_CODES`、`PUBLISH_SKIP_CODES`、发布 serializer 和 summary helper，均收口到 `src/lib/publish/publish.ts`；未新增 Prisma enum。

### 公共化检查
- 复用的公共模块：`src/lib/api-auth.ts`、`src/lib/api-response.ts`、`src/lib/publish/rules.ts`、`src/lib/publish/serializer.ts`、`src/lib/publish/channel-account.ts`、`src/lib/publish/channel-adapter.ts`。
- 新增的公共函数/service：新增 `serializePublish()`、`summarizePublishes()`、`readPublishValidationSnapshot()`、`createPublishesForJob()`。
- 后续需要抽取的重复逻辑：Task 10 失败重试 API 应复用 `readPublishValidationSnapshot()`、`serializePublish()` 和 `getChannelAdapter().retry()`，不要重新拼重试 request id 或复制 publish record serializer。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-api.test.ts`: 先 RED，因 `@/app/api/video-jobs/[jobId]/publish/route` 缺失失败；实现后 GREEN，1 个文件 4 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-schema.test.ts tests/publish-platform-rules.test.ts tests/publish-draft-llm-provider.test.ts tests/publish-draft-generation-service.test.ts tests/publish-drafts-generate-api.test.ts tests/publish-drafts-api.test.ts tests/channel-token.test.ts tests/channel-accounts-api.test.ts tests/channel-oauth-api.test.ts tests/publish-validate-api.test.ts tests/publish-channel-adapter.test.ts tests/publish-api.test.ts`: 通过，12 个文件 46 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过，0 warning / 0 error。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过，新 route `/api/video-jobs/[jobId]/publish` 出现在 build route 列表中。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/tsc --noEmit`: 未通过，剩余失败点为既有测试类型问题，包括 `tests/avatar-detector.test.ts` 缺少 `vi` 导入、`tests/asset-consent.test.ts`/`tests/reference-api.test.ts`/`tests/reference-url-import-worker.test.ts` 的 Prisma JSON 输入类型不匹配、`tests/avatar-ui.test.tsx` fixture 缺少 `SerializedAsset` 字段、`tests/voice-clone-service.test.ts`/`tests/voice-trainer-service.test.ts` 的既有测试类型推断问题；本轮新增 Task 9 文件未出现在错误列表中。

### 验收结论
- 是否满足当前 task：满足 Task 9。
- 是否满足对应 Acceptance Criteria：满足 US-4/AC1 和 US-4/AC2 的后端基础；已授权且检查通过的平台可创建发布记录并保存 request/remote id，过期或未授权平台会标记 skipped 并保存原因。
- 是否允许勾选：允许勾选 Task 9，不允许勾选 Task 10-14。
- MVP 状态矩阵是否需要同步更新：需要，publish-assistant 已从 9/15 推进到 10/15；第 14 行仍保持 `partial`，因为失败重试、发布 UI 和真实平台发布尚未完成。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 9 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-publish-assistant` Task 10。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 10: 实现失败重试 API

### 任务
- Spec: `voflow-publish-assistant`
- Task: 10
- Requirements: US-4

### 修改文件
- `src/lib/publish/publish.ts`
- `src/services/publishService.ts`
- `src/app/api/publishes/[publishId]/retry/route.ts`
- `tests/publish-retry-api.test.ts`
- `.kiro/specs/voflow-publish-assistant/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `POST /api/publishes/[publishId]/retry`，按当前 session 的 team/user 只重试单条发布记录。
- 本次完成：新增 `retryPublish()` service，只允许 `failed` 状态进入重试；非 failed 状态返回 `PUBLISH_RETRY_NOT_ALLOWED`。
- 本次完成：重试复用原 `publishDraft`、`channelAccount`、`publish_drafts.validationJson`、最终视频 artifact 和 `getChannelAdapter().retry()`，不重新散写 mock request id。
- 本次完成：重试成功后更新同一条 `publishes` 记录，保存新的 `requestId`、`remoteId` 和 adapter 返回状态。
- 本次完成：新增 `buildPublishRetryErrorHistory()`，将原失败状态、原 request/remote id 和原错误写入 `errorJson.history`，同时保存本次重试 request/remote 信息到 `lastRetry`。
- 明确未完成：本轮不实现真实平台 adapter、不实现发布状态轮询 Worker、不实现发布 UI、不实现批量重试。
- 是否使用 mock/provider/adapter 占位：是。失败重试 API 当前通过 Task 8 的 mock channel adapter 完成重试模拟，不能按真实平台重试能力验收。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing`、`voflow-packaging-export`、`voflow-publish-assistant` Task 0-9 的实现/测试/文档改动，以及 `src/app/dashboard/voices/page.tsx`、`src/services/workflowWorkerService.ts` 等前序改动。
- 本任务实际改动：新增 retry route、retry service、错误历史 helper、Task 10 focused tests，并同步 Task 10 任务状态、总控 plan 和开发进度说明。
- 未触碰的既有改动：未回滚或重写 advanced-editing、packaging-export、Task 1 schema/migration、Task 2 rules、Task 3 草稿生成、Task 4 草稿查询/编辑、Task 5 渠道账号状态展示、Task 6 OAuth/mock 授权占位、Task 7 发布参数检查、Task 8 Channel Adapter、Task 9 一键发布 API、voices page、workflow worker 等前序改动。

### 硬编码检查
- 是否新增运行时硬编码：未在 route 或 service 散写平台列表、发布状态文案、重试 request id 或 adapter 结果映射；重试错误码和错误历史格式收口到 `src/lib/publish/publish.ts`。
- 新增配置是否收口：本轮未新增 env；继续复用已有 channel account、validation、publish serializer 和 channel adapter 公共模块。
- 新增错误码/状态/枚举是否收口：新增 `PUBLISH_NOT_FOUND`、`PUBLISH_RETRY_NOT_ALLOWED` 和 `PublishRetryErrorHistory` 格式，均收口到 `src/lib/publish/publish.ts`；未新增 Prisma enum。

### 公共化检查
- 复用的公共模块：`src/lib/api-auth.ts`、`src/lib/api-response.ts`、`src/lib/publish/rules.ts`、`src/lib/publish/serializer.ts`、`src/lib/publish/channel-account.ts`、`src/lib/publish/channel-adapter.ts`、`src/lib/publish/publish.ts`。
- 新增的公共函数/service：新增 `buildPublishRetryErrorHistory()`、`retryPublish()`。
- 后续需要抽取的重复逻辑：Task 12 发布中心 UI 应直接消费 `SerializedPublish.errorJson.history`、`requestId`、`remoteId` 和 `status`，不要在前端重新推断历史失败原因。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-retry-api.test.ts`: 先 RED，因 `@/app/api/publishes/[publishId]/retry/route` 缺失失败；实现后 GREEN，1 个文件 4 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-schema.test.ts tests/publish-platform-rules.test.ts tests/publish-draft-llm-provider.test.ts tests/publish-draft-generation-service.test.ts tests/publish-drafts-generate-api.test.ts tests/publish-drafts-api.test.ts tests/channel-token.test.ts tests/channel-accounts-api.test.ts tests/channel-oauth-api.test.ts tests/publish-validate-api.test.ts tests/publish-channel-adapter.test.ts tests/publish-api.test.ts tests/publish-retry-api.test.ts`: 通过，13 个文件 50 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过，0 warning / 0 error。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过，新 route `/api/publishes/[publishId]/retry` 出现在 build route 列表中。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/tsc --noEmit`: 未通过，剩余失败点为既有测试类型问题，包括 `tests/avatar-detector.test.ts` 缺少 `vi` 导入、`tests/asset-consent.test.ts`/`tests/reference-api.test.ts`/`tests/reference-url-import-worker.test.ts` 的 Prisma JSON 输入类型不匹配、`tests/avatar-ui.test.tsx` fixture 缺少 `SerializedAsset` 字段、`tests/voice-clone-service.test.ts`/`tests/voice-trainer-service.test.ts` 的既有测试类型推断问题；本轮新增 Task 10 文件未出现在错误列表中。

### 验收结论
- 是否满足当前 task：满足 Task 10。
- 是否满足对应 Acceptance Criteria：满足 US-4/AC3 的后端基础；重试 API 只允许 failed 发布记录，只重试单个平台，并保存新的 request id、remote id 和原失败原因历史。
- 是否允许勾选：允许勾选 Task 10，不允许勾选 Task 11-14。
- MVP 状态矩阵是否需要同步更新：需要，publish-assistant 已从 10/15 推进到 11/15；第 14 行仍保持 `partial`，因为发布 UI 和真实平台发布尚未完成。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 10 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-publish-assistant` Task 11。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 11: 实现封面与发布信息 UI

### 任务
- Spec: `voflow-publish-assistant`
- Task: 11
- Requirements: US-1、US-3

### 修改文件
- `src/components/publish/PublishDraftEditor.tsx`
- `src/app/dashboard/publish/page.tsx`
- `tests/publish-ui.test.tsx`
- `.kiro/specs/voflow-publish-assistant/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `PublishDraftEditor` 客户端组件，按平台草稿渲染平台 tabs，并支持编辑标题、标签、描述、话题和封面 Artifact ID。
- 本次完成：标题字数、标签数量、封面推荐比例、封面允许比例和视频时长提示均来自 `draft.rule`，页面不散写平台规则。
- 本次完成：`/dashboard/publish` 从占位页替换为发布信息编辑工作区，支持输入视频任务 ID、调用 `GET /api/video-jobs/[jobId]/publish-drafts` 加载草稿，并调用 `PUT /api/publish-drafts/[draftId]` 保存草稿。
- 本次完成：新增 tags/topics 输入解析 helper，支持逗号、中文逗号和换行分隔，并去重。
- 明确未完成：本轮不实现发布中心总控 UI、不展示账号授权状态、不执行发布参数检查、不发起一键发布、不展示发布日志、不接真实平台 adapter。
- 是否使用 mock/provider/adapter 占位：否。本轮只实现前端编辑 UI；后端发布能力仍沿用前序 mock adapter 边界。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing`、`voflow-packaging-export`、`voflow-publish-assistant` Task 0-10 的实现/测试/文档改动，以及 `src/app/dashboard/voices/page.tsx`、`src/services/workflowWorkerService.ts` 等前序改动。
- 本任务实际改动：新增发布草稿编辑组件、替换发布中心占位页、补充 Task 11 UI tests，并同步 Task 11 任务状态、总控 plan 和开发进度说明。
- 未触碰的既有改动：未回滚或重写 advanced-editing、packaging-export、Task 1 schema/migration、Task 2 rules、Task 3 草稿生成、Task 4 草稿查询/编辑 API、Task 5-10 发布账号/校验/adapter/发布/重试后端能力、voices page、workflow worker 等前序改动。

### 硬编码检查
- 是否新增运行时硬编码：未在页面散写平台列表、标题长度、标签数量、封面比例或视频时长限制；这些提示全部来自 API 返回的 `draft.rule`。
- 新增配置是否收口：本轮未新增 env 或配置项。
- 新增错误码/状态/枚举是否收口：本轮未新增错误码、状态或 Prisma enum；保存错误沿用 API 返回 `message`。

### 公共化检查
- 复用的公共模块：`src/lib/publish/serializer.ts` 的 `SerializedPublishDraft`、发布草稿查询 API、发布草稿编辑 API。
- 新增的公共函数/service：新增 `createPublishDraftFormState()`、`parsePublishDelimitedText()` 和 `PublishDraftEditor`。
- 后续需要抽取的重复逻辑：Task 12 发布中心 UI 应复用 `PublishDraftEditor` 或其 view model 类型，不要在发布中心页面重复实现平台草稿字段编辑和 rule 提示。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-ui.test.tsx`: 先 RED，因 `@/components/publish/PublishDraftEditor` 缺失失败；实现后 GREEN，1 个文件 4 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-schema.test.ts tests/publish-platform-rules.test.ts tests/publish-draft-llm-provider.test.ts tests/publish-draft-generation-service.test.ts tests/publish-drafts-generate-api.test.ts tests/publish-drafts-api.test.ts tests/channel-token.test.ts tests/channel-accounts-api.test.ts tests/channel-oauth-api.test.ts tests/publish-validate-api.test.ts tests/publish-channel-adapter.test.ts tests/publish-api.test.ts tests/publish-retry-api.test.ts tests/publish-ui.test.tsx`: 通过，14 个文件 54 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过，0 warning / 0 error。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过，`/dashboard/publish` bundle 已变为真实发布页面。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/tsc --noEmit`: 未通过，剩余失败点为既有测试类型问题，包括 `tests/avatar-detector.test.ts` 缺少 `vi` 导入、`tests/asset-consent.test.ts`/`tests/reference-api.test.ts`/`tests/reference-url-import-worker.test.ts` 的 Prisma JSON 输入类型不匹配、`tests/avatar-ui.test.tsx` fixture 缺少 `SerializedAsset` 字段、`tests/voice-clone-service.test.ts`/`tests/voice-trainer-service.test.ts` 的既有测试类型推断问题；本轮新增 Task 11 文件未出现在错误列表中。

### 验收结论
- 是否满足当前 task：满足 Task 11。
- 是否满足对应 Acceptance Criteria：满足 US-1/AC2、US-1/AC3 和 US-3 的 UI 基础；页面能展示平台规则限制，并通过现有草稿编辑 API 保存平台独立草稿。
- 是否允许勾选：允许勾选 Task 11，不允许勾选 Task 12-14。
- MVP 状态矩阵是否需要同步更新：需要，publish-assistant 已从 11/15 推进到 12/15；第 14 行仍保持 `partial`，因为发布中心总控 UI、测试补齐和 checkpoint 尚未完成。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 11 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-publish-assistant` Task 12。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 12: 实现发布中心 UI

### 任务
- Spec: `voflow-publish-assistant`
- Task: 12
- Requirements: US-2、US-3、US-4

### 修改文件
- `src/lib/publish/ui.ts`
- `src/components/publish/PublishCenterPanel.tsx`
- `src/app/dashboard/publish/page.tsx`
- `tests/publish-ui.test.tsx`
- `.kiro/specs/voflow-publish-assistant/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增发布中心操作台 `PublishCenterPanel`，集中展示账号授权状态、发布参数检查、发布动作和发布日志。
- 本次完成：`/dashboard/publish` 接入 `GET /api/channel-accounts`，页面打开和刷新时展示 connected、expired、not_connected 的账号昵称、授权状态和重新授权入口。
- 本次完成：发布中心接入 `POST /api/video-jobs/[jobId]/publish/validate`，即使检查返回 `PUBLISH_VALIDATION_FAILED` 也会读取结构化 `data.results` 展示各平台阻断原因。
- 本次完成：发布中心支持定时发布时间输入、保存草稿入口提示、仅导出 MP4、发布前检查、一键发布和 failed 发布记录单平台重试入口。
- 本次完成：仅导出 MP4 复用现有 `POST /api/video-jobs/[jobId]/export`，使用 `outputProfile: "mp4_1080p"` 创建导出任务。
- 本次完成：一键发布复用 `POST /api/video-jobs/[jobId]/publish`，并在本页发布日志中展示 status、requestId、remoteId、错误原因和重试按钮。
- 明确未完成：本轮不新增发布历史查询 API；发布日志展示本页一键发布/重试操作返回的结果。定时发布当前只完成 UI 输入和请求 payload 透传，后端调度能力不在 Task 12 范围。真实开放平台 OAuth/发布 adapter 仍未接入。
- 是否使用 mock/provider/adapter 占位：是。授权按钮调用已有 mock authorize 接口，一键发布和重试仍复用 mock channel adapter，不能按真实平台发布能力验收。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing`、`voflow-packaging-export`、`voflow-publish-assistant` Task 0-11 的实现/测试/文档改动，以及 `.codegraph/daemon.pid` 等前序工具状态文件。
- 本任务实际改动：新增发布中心 UI helper、发布中心操作台组件、页面 API 动作接入、Task 12 UI tests，并同步 Task 12 任务状态、总控 plan 和开发进度说明。
- 未触碰的既有改动：未回滚或重写 advanced-editing、packaging-export、Task 1 schema/migration、Task 2 rules、Task 3 草稿生成、Task 4 草稿查询/编辑 API、Task 5-10 发布账号/校验/adapter/发布/重试后端能力、Task 11 发布信息编辑 UI、voices page、workflow worker 等前序改动。

### 硬编码检查
- 是否新增运行时硬编码：未在页面散写发布状态文案、发布按钮文案或检查摘要；发布状态 label、tone 和动作 label 收口到 `src/lib/publish/ui.ts`。页面没有新增平台列表，平台范围来自已加载草稿和 API 返回账号。
- 新增配置是否收口：本轮未新增 env 或运行时配置；仅导出 MP4 复用现有导出 API 的 `mp4_1080p` profile。
- 新增错误码/状态/枚举是否收口：本轮未新增错误码或 Prisma enum；新增 `PUBLISH_STATUS_UI`、`PUBLISH_ACTION_LABELS` 和检查摘要 helper 均收口到 `src/lib/publish/ui.ts`。

### 公共化检查
- 复用的公共模块：`src/lib/api-response.ts` 返回结构、`src/lib/publish/channel-account.ts` 的账号 serializer、`src/lib/publish/validation.ts` 的检查结果类型、`src/lib/publish/publish.ts` 的发布记录 serializer、`src/lib/publish/rules.ts` 的平台类型、现有发布检查/一键发布/重试/导出 API。
- 新增的公共函数/service：新增 `getPublishStatusLabel()`、`getPublishStatusTone()`、`summarizePublishValidationResults()`、`getPublishPlatformDisplayName()` 和 `PublishCenterPanel`。
- 后续需要抽取的重复逻辑：若后续 Task 13 增加交互级测试，可再抽前端 fetch hook；当前仅一处页面使用，暂不新增 hook 抽象。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-ui.test.tsx`: 先 RED，因 `@/components/publish/PublishCenterPanel` 缺失失败；实现后 GREEN，1 个文件 6 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-drafts-api.test.ts tests/publish-draft-generation-service.test.ts tests/publish-validate-api.test.ts tests/publish-draft-llm-provider.test.ts tests/publish-retry-api.test.ts tests/publish-channel-adapter.test.ts tests/channel-token.test.ts tests/publish-api.test.ts tests/channel-oauth-api.test.ts tests/publish-platform-rules.test.ts tests/publish-drafts-generate-api.test.ts tests/publish-ui.test.tsx tests/publish-schema.test.ts tests/channel-accounts-api.test.ts`: 通过，14 个文件 56 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/tsc --noEmit`: 未通过，剩余失败点为既有测试类型问题，包括 `tests/avatar-detector.test.ts` 缺少 `vi` 导入、`tests/asset-consent.test.ts`/`tests/reference-api.test.ts`/`tests/reference-url-import-worker.test.ts` 的 Prisma JSON 输入类型不匹配、`tests/avatar-ui.test.tsx` fixture 缺少 `SerializedAsset` 字段、`tests/voice-clone-service.test.ts`/`tests/voice-trainer-service.test.ts` 的既有测试类型推断问题；本轮新增 Task 12 文件未出现在错误列表中。

### 验收结论
- 是否满足当前 task：满足 Task 12。
- 是否满足对应 Acceptance Criteria：满足 US-2 的账号授权状态展示和授权/重新授权入口；满足 US-3 的发布前检查结果展示和阻断原因展示；满足 US-4 的一键发布日志、部分失败状态展示和 failed 单平台重试入口。真实开放平台发布能力仍按 mock adapter 边界说明处理。
- 是否允许勾选：允许勾选 Task 12，不允许勾选 Task 13-14。
- MVP 状态矩阵是否需要同步更新：需要，publish-assistant 已从 12/15 推进到 13/15；第 14 行仍保持 `partial`，因为 Task 13 测试补齐和 Task 14 checkpoint 尚未完成，真实平台发布也尚未接入。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 12 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-publish-assistant` Task 13。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 13: 添加测试

### 任务
- Spec: `voflow-publish-assistant`
- Task: 13
- Requirements: US-1、US-2、US-3、US-4

### 修改文件
- `tests/publish-assistant-acceptance.test.ts`
- `.kiro/specs/voflow-publish-assistant/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `tests/publish-assistant-acceptance.test.ts`，作为发布辅助验收补充测试，覆盖 Task 13 指定四条场景。
- 本次完成：覆盖“平台草稿生成”，验证 approved script 经 `generatePublishDrafts()` 为抖音和小红书生成并持久化平台独立 title、description、tags、topics。
- 本次完成：覆盖“标题超长阻断发布”，验证小红书标题超长会在 `validatePublishParameters()` 中产生 `PUBLISH_TITLE_TOO_LONG`，随后 `createPublishesForJob()` 将该平台标记为 skipped，不创建 requestId/remoteId。
- 本次完成：覆盖“token 过期平台 skipped”，验证即使草稿 validationJson 已通过，只要 channel account 当前状态为 expired，一键发布仍写入 `CHANNEL_TOKEN_EXPIRED` skipped 记录。
- 本次完成：覆盖“部分平台失败后可单独重试”，构造一个已 published 平台和一个 failed 平台，调用 `retryPublish()` 只更新 failed 记录，并保留原失败 error history，不改动已成功平台记录。
- 明确未完成：本轮不新增生产代码、不新增真实平台 adapter、不新增真实 OAuth、不新增发布历史查询 API。
- 是否使用 mock/provider/adapter 占位：是。新增测试继续验证当前 MVP 的 mock channel adapter 行为，不能按真实平台发布能力验收。

### 工作区状态
- 开始前已有未提交改动：`.kiro/plans/voflow-platform/plan.md`、`docs/05-开发进度说明.md` 处于已修改状态；Task 12 的发布中心代码和测试已在当前索引基线中。
- 本任务实际改动：新增发布辅助 acceptance 测试文件，并同步 Task 13 任务状态、总控 plan 和开发进度说明。
- 未触碰的既有改动：未回滚或重写 advanced-editing、packaging-export、Task 1-12 的发布 schema/service/API/UI 实现、voices page、workflow worker 等前序改动。

### 硬编码检查
- 是否新增运行时硬编码：否。本轮未修改运行时代码；测试 fixture 中使用平台、账号、requestId、错误码和标题文案用于验收断言，属于 `tests/**` 允许范围。
- 新增配置是否收口：本轮未新增 env 或运行时配置。
- 新增错误码/状态/枚举是否收口：本轮未新增错误码、状态或 Prisma enum；测试复用已有 `PUBLISH_VALIDATION_CHECK_CODES`、`CHANNEL_TOKEN_EXPIRED`、`PUBLISH_REMOTE_FAILED` 和 Prisma enum。

### 公共化检查
- 复用的公共模块：`generatePublishDrafts()`、`validatePublishParameters()`、`createPublishesForJob()`、`retryPublish()`、`PUBLISH_VALIDATION_CHECK_CODES` 和现有 Prisma models。
- 新增的公共函数/service：无，Task 13 只新增测试。
- 后续需要抽取的重复逻辑：新增 acceptance 测试含独立 fixture helper。若 Task 14 checkpoint 或后续发布端到端测试继续复用同一类 fixture，可再抽 `tests/helpers/publish.ts`；当前未达到必须抽取的重复程度。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-assistant-acceptance.test.ts`: 通过，1 个文件 4 个测试通过。说明：Task 13 是既有能力测试补齐，不新增生产代码，因此新增测试直接验证已实现行为，未产生传统 RED。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-assistant-acceptance.test.ts tests/publish-drafts-api.test.ts tests/publish-draft-generation-service.test.ts tests/publish-validate-api.test.ts tests/publish-draft-llm-provider.test.ts tests/publish-retry-api.test.ts tests/publish-channel-adapter.test.ts tests/channel-token.test.ts tests/publish-api.test.ts tests/channel-oauth-api.test.ts tests/publish-platform-rules.test.ts tests/publish-drafts-generate-api.test.ts tests/publish-ui.test.tsx tests/publish-schema.test.ts tests/channel-accounts-api.test.ts`: 通过，15 个文件 60 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/tsc --noEmit`: 未通过，剩余失败点为既有测试类型问题，包括 `tests/avatar-detector.test.ts` 缺少 `vi` 导入、`tests/asset-consent.test.ts`/`tests/reference-api.test.ts`/`tests/reference-url-import-worker.test.ts` 的 Prisma JSON 输入类型不匹配、`tests/avatar-ui.test.tsx` fixture 缺少 `SerializedAsset` 字段、`tests/voice-clone-service.test.ts`/`tests/voice-trainer-service.test.ts` 的既有测试类型推断问题；本轮新增 Task 13 文件未出现在错误列表中。

### 验收结论
- 是否满足当前 task：满足 Task 13。
- 是否满足对应 Acceptance Criteria：满足 US-1 的平台草稿生成覆盖；满足 US-3 的标题超长阻断发布覆盖；满足 US-2/US-4 的 token 过期 skipped 覆盖；满足 US-4 的部分平台失败后只重试 failed 平台覆盖。
- 是否允许勾选：允许勾选 Task 13，不允许勾选 Task 14。
- MVP 状态矩阵是否需要同步更新：需要，publish-assistant 已从 13/15 推进到 14/15；第 14 行仍保持 `partial`，因为 Task 14 checkpoint 尚未完成，真实平台发布也尚未接入。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 13 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-publish-assistant` Task 14 checkpoint。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 14: Checkpoint: 发布辅助验收

### 任务
- Spec: `voflow-publish-assistant`
- Task: 14
- Requirements: US-1、US-2、US-3、US-4

### 修改文件
- `.kiro/specs/voflow-publish-assistant/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：逐条对照 `requirements.md`、`design.md` 和 Task 0-13 执行反馈，完成发布辅助 checkpoint 验收。
- 本次完成：确认最终文案存在后可生成平台草稿，证据包括 `generatePublishDrafts()`、`POST /api/video-jobs/[jobId]/publish-drafts/generate`、发布草稿查询/编辑 API、`PublishDraftEditor` 和 `tests/publish-assistant-acceptance.test.ts` 的平台草稿生成覆盖。
- 本次完成：确认授权状态和参数检查可见，证据包括 `GET /api/channel-accounts`、mock authorize API、`POST /api/video-jobs/[jobId]/publish/validate`、`PublishCenterPanel`、`tests/channel-accounts-api.test.ts`、`tests/channel-oauth-api.test.ts`、`tests/publish-validate-api.test.ts`、`tests/publish-ui.test.tsx`。
- 本次完成：确认一键发布支持部分成功、失败原因和重试，证据包括 `POST /api/video-jobs/[jobId]/publish`、`POST /api/publishes/[publishId]/retry`、mock `PublishChannelAdapter`、`tests/publish-api.test.ts`、`tests/publish-retry-api.test.ts`、`tests/publish-assistant-acceptance.test.ts`。
- 本次完成：确认 15 个 publish focused test 文件 60 个测试通过，`next lint`、`git diff --check`、`next build` 通过；`/dashboard/publish` 在本地 dev server 上作为受保护页面返回登录重定向。
- 明确未完成：真实开放平台 OAuth、真实平台上传/发布/状态同步、真实平台失败重试、发布历史查询 API、定时发布后端调度不在本 checkpoint 内完成。当前发布能力按 mock adapter MVP 边界验收。
- 是否使用 mock/provider/adapter 占位：是。`GET /api/channel-accounts/[platform]/authorize` 和 `POST /api/channel-accounts/[platform]/mock-authorize` 是 mock OAuth 占位；`getChannelAdapter()` 当前统一返回 mock adapter；不能按真实平台发布能力标记为完成。

### 工作区状态
- 开始前已有未提交改动：Task 13 新增的 `tests/publish-assistant-acceptance.test.ts`，以及 `.kiro/plans/voflow-platform/plan.md`、`.kiro/specs/voflow-publish-assistant/tasks.md`、`docs/05-开发进度说明.md` 的 Task 13 同步改动。
- 本任务实际改动：仅勾选 Task 14、追加 checkpoint 执行反馈，并同步总控 plan 和开发进度说明；未修改生产代码。
- 未触碰的既有改动：未回滚或重写 advanced-editing、packaging-export、Task 1-13 的发布 schema/service/API/UI/tests 实现、voices page、workflow worker 等前序改动。

### 硬编码检查
- 是否新增运行时硬编码：否。本轮只更新 Kiro/进度文档，未修改运行时代码。
- 新增配置是否收口：本轮未新增 env 或运行时配置。
- 新增错误码/状态/枚举是否收口：本轮未新增错误码、状态或 Prisma enum；checkpoint 复核确认已有发布错误码、发布状态、账号状态、平台规则和 UI 状态文案均在 `src/lib/publish/*` 或 Prisma enum 中收口。

### 公共化检查
- 复用的公共模块：`src/lib/publish/rules.ts`、`src/lib/publish/serializer.ts`、`src/lib/publish/channel-account.ts`、`src/lib/publish/oauth.ts`、`src/lib/publish/token.ts`、`src/lib/publish/validation.ts`、`src/lib/publish/channel-adapter.ts`、`src/lib/publish/publish.ts`、`src/lib/publish/ui.ts`、发布 draft/account/validation/publish services 和统一 API response/auth helper。
- 新增的公共函数/service：无，checkpoint 只做验收与文档同步。
- 后续需要抽取的重复逻辑：若后续接入真实平台 adapter 或端到端浏览器测试，可抽 `tests/helpers/publish.ts` 复用 publish fixture；当前 checkpoint 不新增抽象。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/publish-assistant-acceptance.test.ts tests/publish-drafts-api.test.ts tests/publish-draft-generation-service.test.ts tests/publish-validate-api.test.ts tests/publish-draft-llm-provider.test.ts tests/publish-retry-api.test.ts tests/publish-channel-adapter.test.ts tests/channel-token.test.ts tests/publish-api.test.ts tests/channel-oauth-api.test.ts tests/publish-platform-rules.test.ts tests/publish-drafts-generate-api.test.ts tests/publish-ui.test.tsx tests/publish-schema.test.ts tests/channel-accounts-api.test.ts`: 通过，15 个文件 60 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过，0 warning / 0 error。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过，`/dashboard/publish` 和发布相关 API route 均进入 build route 列表。
- `curl -I http://localhost:3000/dashboard/publish`: 通过，返回 `307 Temporary Redirect` 到 `/login?from=%2Fdashboard%2Fpublish`，符合受保护 dashboard 页面预期。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/tsc --noEmit`: 未通过，剩余失败点为既有测试类型问题，包括 `tests/avatar-detector.test.ts` 缺少 `vi` 导入、`tests/asset-consent.test.ts`/`tests/reference-api.test.ts`/`tests/reference-url-import-worker.test.ts` 的 Prisma JSON 输入类型不匹配、`tests/avatar-ui.test.tsx` fixture 缺少 `SerializedAsset` 字段、`tests/voice-clone-service.test.ts`/`tests/voice-trainer-service.test.ts` 的既有测试类型推断问题；发布助手相关文件和 Task 13 新增测试未出现在错误列表中。

### 验收结论
- 是否满足当前 task：满足 Task 14。
- 是否满足对应 Acceptance Criteria：满足 US-1 到 US-4 的 MVP/mock adapter 边界验收；每条 AC 均有 service/API/UI/test 或执行反馈证据。
- 是否允许勾选：允许勾选 Task 14；`voflow-publish-assistant` checklist 已 15/15 完成。
- MVP 状态矩阵是否需要同步更新：需要，`voflow-publish-assistant` checklist 完成，但 MVP 主线第 13、14 行仍保持 `partial`，因为真实开放平台 OAuth/Adapter/发布状态同步尚未接入，不能按真实平台发布能力标记为 done。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 14 并追加 checkpoint 执行反馈。
- 是否更新 `plan.md`：是，当前开发游标更新为 publish-assistant checkpoint 已完成，后续进入真实平台接入/最终 MVP 环境复验。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界；mock/provider 边界已在执行反馈和 MVP 状态矩阵缺口中说明。
