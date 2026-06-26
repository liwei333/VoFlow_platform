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

- [ ] 9. 实现一键发布 API
  - 只对检查通过且 connected 的平台创建发布任务
  - expired 或 not_connected 平台标记 skipped
  - 保存 request_id 和平台结果
  - _Requirements: US-4_

- [ ] 10. 实现失败重试 API
  - 只允许 failed 状态重试
  - 只重试单个平台
  - 保存新 request_id 和错误历史
  - _Requirements: US-4_

- [ ] 11. 实现封面与发布信息 UI
  - 平台 tabs
  - 标题、标签、描述、话题编辑
  - 标题限制、标签数量、封面比例提示
  - _Requirements: US-1, US-3_

- [ ] 12. 实现发布中心 UI
  - 展示账号授权状态
  - 展示发布参数检查
  - 支持定时发布、保存草稿、仅导出 MP4、一键发布
  - 展示发布日志
  - _Requirements: US-2, US-3, US-4_

- [ ] 13. 添加测试
  - 平台草稿生成
  - 标题超长阻断发布
  - token 过期平台 skipped
  - 部分平台失败后可单独重试
  - _Requirements: US-1, US-2, US-3, US-4_

- [ ] 14. Checkpoint: 发布辅助验收
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
