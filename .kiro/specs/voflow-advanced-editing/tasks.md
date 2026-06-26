# Tasks: voflow-advanced-editing

## Implementation Plan

- [x] 0. 执行后续开发规范检查
  - 先阅读 `AI_RULES.md`
  - 本 Spec 不得在 API、Worker 或 UI 中散写字幕样式、BGM 音量、画中画位置、转场参数、错误码、状态文案或素材授权规则
  - 剪辑配置 schema、素材授权校验、预览 Worker、字幕样式模板和 API 响应必须进入公共 helper/service
  - 若发现同类逻辑已经重复两处以上，先抽公共函数或公共常量，再继续业务实现
  - Checkpoint 反馈必须包含硬编码检查、公共函数提取情况和验证命令
  - _Requirements: US-1, US-2, US-3_

- [x] 1. 创建剪辑配置数据表
  - 创建 `editing_configs`
  - 添加 pip_position、volume、size 校验
  - 绑定 job_id 和 preview_artifact_id
  - _Requirements: US-1, US-2, US-3_

- [x] 2. 实现剪辑配置查询 API
  - 返回默认字幕、BGM、画中画、背景、转场配置
  - 若未配置则生成默认值
  - _Requirements: US-1, US-2, US-3_

- [x] 3. 实现剪辑配置保存 API
  - 保存字幕开关和关键词高亮
  - 保存画中画参数
  - 保存音量和转场参数
  - _Requirements: US-1, US-2, US-3_

- [x] 4. 实现画中画素材授权校验
  - 校验 pip_asset_id 属于当前 team
  - 校验 license_status approved
  - 未授权时拒绝保存
  - _Requirements: US-2_

- [x] 5. 实现背景素材授权校验
  - 支持背景图和背景视频
  - 校验素材授权
  - 记录背景素材引用
  - _Requirements: US-3_

- [x] 6. 实现关键词高亮配置生成
  - 从确认文案中提取关键词
  - 允许用户开关高亮
  - 输出 ASS 字幕可用样式配置
  - _Requirements: US-1_

- [x] 7. 实现剪辑预览 Worker
  - 可先返回轻量预览配置
  - 后续用 FFmpeg 生成低清预览
  - 保存 preview artifact
  - _Requirements: US-3_

- [x] 8. 实现视频剪辑 UI
  - 字幕开关、关键词高亮、BGM 自动闪避
  - 画中画开关、大小和位置
  - 人声/BGM 音量、转场强度
  - 剪辑预览按钮
  - _Requirements: US-1, US-2, US-3_

- [x] 9. 添加测试
  - 未授权画中画素材被拒绝
  - 音量越界被拒绝
  - 保存配置后可查询
  - 预览失败写入错误
  - _Requirements: US-1, US-2, US-3_

- [x] 10. Checkpoint: 高级剪辑验收
  - 用户可保存字幕/BGM/画中画/背景/转场配置
  - 未授权素材不能用于画中画或背景
  - 配置可传递给最终导出节点
  - _Requirements: US-1, US-2, US-3_

## 执行反馈

### Task 0: 后续开发规范检查与任务执行判断

### 任务
- Spec: `voflow-advanced-editing`
- Task: 0
- Requirements: US-1、US-2、US-3

### 修改文件
- `.kiro/specs/voflow-advanced-editing/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`

### 范围说明
- 本次完成：读取并对照根目录 `AI_RULES.md`、`.kiro/plans/voflow-platform/plan.md`、本 Spec 的 `requirements.md`、`design.md`、`tasks.md`，确认当前总控游标允许从已完成 checkpoint 的 `voflow-video-render` 进入 `voflow-advanced-editing`。
- 本次完成：确认 `voflow-advanced-editing` 的实现边界是基于 `avatar_video` 中间产物生成剪辑配置和低成本预览，不重新触发数字人渲染，最终 FFmpeg 合成仍由 `voflow-packaging-export` 负责。
- 本次完成：复核现有公共基础，确认 `editing_preview` workflow node 已存在于 `src/lib/workflow/constants.ts`，资产授权可复用 `src/lib/assets/consent.ts` 的 `assertAssetUsable()`，数字人渲染结果可通过 `src/services/avatarRenderResultService.ts` 查询 `avatar_video` artifact，Worker 执行入口仍需在 `src/services/workflowWorkerService.ts` 注册。
- 当前任务执行判断：Task 1 是下一个可执行任务，应先创建 `editing_configs` 数据表和 Prisma model/migration，绑定 `jobId` 和可选 `previewArtifactId`，并用 schema 测试约束 `pip_position`、`pip_size`、`voice_volume`、`bgm_volume` 等字段。
- 明确未完成：本轮未创建数据库表、未实现剪辑配置 API、未实现素材授权校验、未实现关键词高亮、未实现 preview Worker、未实现剪辑 UI。
- 是否使用 mock/provider/adapter 占位：本轮未新增运行时代码；后续 Task 7 可先返回轻量预览配置或 mock preview artifact，但必须在执行反馈中标明边界，不能按真实 FFmpeg 低清预览验收。

### 工作区状态
- 开始前已有未提交改动：根目录 `AI_RULES.md` 迁移、`.kiro` 中开发规范路径替换、`voflow-video-render` Task 10-12 的 UI/测试/文档改动、`docs/05-开发进度说明.md` 新增和同步、`src/components/avatar-render/`、`src/lib/avatar-render/ui.ts`、`tests/avatar-render-acceptance.test.ts`、`tests/avatar-render-ui.test.tsx` 等。
- 本任务实际改动：仅更新 `voflow-advanced-editing` Task 0 勾选和执行反馈，并同步总控 plan 的当前游标。
- 未触碰的既有改动：未修改前序 avatar render UI、worker、provider、测试实现和根目录 `AI_RULES.md` 内容。

### 硬编码检查
- 是否新增运行时硬编码：否，本轮只更新 Kiro 文档。
- 新增配置是否收口：本轮未新增配置；后续字幕样式、BGM 音量、画中画位置/大小、转场强度、preview artifact 类型、错误码和状态文案必须收口到 `src/lib/editing/*` 或等价领域模块。
- 新增错误码/状态/枚举是否收口：本轮未新增；后续 `PIP_ASSET_LICENSE_NOT_APPROVED`、`BACKGROUND_ASSET_LICENSE_NOT_APPROVED`、`EDITING_PREVIEW_FAILED`、pip position、volume range、transition range 应统一收口，route/worker/UI 不散写。

### 公共化检查
- 复用的公共模块：`src/lib/workflow/constants.ts`、`src/lib/workflow/status.ts`、`src/services/workflowWorkerService.ts`、`src/lib/assets/consent.ts`、`src/lib/assets/serializer.ts`、`src/lib/api-auth.ts`、`src/lib/api-response.ts`、`src/services/avatarRenderResultService.ts`、`src/services/workflowArtifactService.ts`、`src/lib/storage.ts`。
- 新增的公共函数/service：无。
- 后续需要抽取的重复逻辑：Task 1-3 应新增 `src/lib/editing/constants.ts`、`src/lib/editing/validation.ts`、`src/lib/editing/serializer.ts`、`src/services/editingConfigService.ts`；Task 4-5 应封装画中画/背景素材授权校验，避免 API 和 UI 直接判断 `licenseStatus`；Task 7 应新增 preview worker service 并通过 `editing_preview` node 接入 workflow。

### 验证命令
- `rg -n "editing_preview|assertAssetUsable|avatar_video|editing_configs|PIP_ASSET_LICENSE_NOT_APPROVED|BACKGROUND_ASSET_LICENSE_NOT_APPROVED|EDITING_PREVIEW_FAILED" src prisma tests .kiro/specs/voflow-advanced-editing .kiro/plans/voflow-platform/plan.md`: 通过，确认 workflow 已有 `editing_preview`，资产授权和 avatar video 查询已有可复用基础，`editing_configs` 尚未实现。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过，无 ESLint warnings/errors。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 0。
- 是否满足对应 Acceptance Criteria：满足启动 `voflow-advanced-editing` 前的规范检查、公共化边界确认和任务执行判断；US-1 到 US-3 的业务实现从 Task 1 开始。
- 是否允许勾选：允许勾选 Task 0，不允许勾选 Task 1-10。
- MVP 状态矩阵是否需要同步更新：需要，`voflow-advanced-editing` 仍无用户可用能力，MVP 主线第 12 行保持 `not_started`；Spec 状态表可进入 `partial`，下一步为 Task 1 创建剪辑配置数据表。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 0 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标应推进到 `voflow-advanced-editing` Task 1。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 1: 创建剪辑配置数据表

### 任务
- Spec: `voflow-advanced-editing`
- Task: 1
- Requirements: US-1、US-2、US-3

### 修改文件
- `prisma/schema.prisma`
- `prisma/migrations/20260624112600_add_editing_configs/migration.sql`
- `tests/editing-config-schema.test.ts`
- `.kiro/specs/voflow-advanced-editing/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `EditingPipPosition` Prisma enum，取值为 `top_left`、`top_right`、`bottom_left`、`bottom_right`，用于收口画中画位置。
- 本次完成：新增 `EditingConfig` Prisma model 并映射到 `editing_configs`，字段覆盖字幕开关、关键词高亮、BGM ducking、画中画开关、画中画素材、画中画位置/大小、背景素材、人声/BGM 音量、转场强度、扩展配置、预览 artifact、创建和更新时间。
- 本次完成：`editing_configs.jobId` 与 `video_jobs.id` 建立一对一唯一绑定，`previewArtifactId` 与 `artifacts.id` 建立可选外键绑定；同时为 `pipAssetId`、`backgroundAssetId` 建立可选 `assets.id` 外键，便于后续 Task 4-5 做素材授权校验。
- 本次完成：数据库 migration 添加 `pipSize`、`voiceVolume`、`bgmVolume` 的 CHECK 约束，分别限制 `10-60`、`0-100`、`0-100`。
- 明确未完成：本轮未实现查询 API、保存 API、素材授权校验、关键词高亮配置生成、剪辑预览 Worker、剪辑 UI、最终导出参数传递。
- 是否使用 mock/provider/adapter 占位：否，本轮只新增数据库 schema、migration 和 schema 验收测试。

### 工作区状态
- 开始前已有未提交改动：根目录 `AI_RULES.md` 迁移、`.kiro` 中开发规范路径替换、`voflow-video-render` Task 10-12 的 UI/测试/文档改动、`voflow-advanced-editing` Task 0 反馈、`docs/05-开发进度说明.md` 新增和同步、`src/components/avatar-render/`、`src/lib/avatar-render/ui.ts`、`tests/avatar-render-acceptance.test.ts`、`tests/avatar-render-ui.test.tsx` 等。
- 本任务实际改动：新增 `editing_configs` 数据库结构、Prisma model/relations、迁移文件、schema 验收测试，并同步当前 task、总控 plan 和进度文档。
- 未触碰的既有改动：未修改前序 avatar render UI、worker、provider、acceptance/UI 测试实现；未回滚其他 spec 的规范路径替换。

### 硬编码检查
- 是否新增运行时硬编码：否；本轮未新增 API、Worker 或 UI 运行时代码。
- 新增配置是否收口：本轮未新增环境配置；剪辑配置默认值只作为数据库默认值和 Prisma model 默认值存在，后续 Task 2-3 若在 API/UI 使用默认配置，应抽到 `src/lib/editing/constants.ts` 或等价领域模块。
- 新增错误码/状态/枚举是否收口：新增画中画位置枚举已收口为 Prisma enum `EditingPipPosition`；本轮未新增 API 错误码。

### 公共化检查
- 复用的公共模块：`@/lib/db` 作为 schema 测试数据库入口，沿用现有 schema 测试的 `information_schema` / `pg_constraint` / `pg_indexes` 查询模式。
- 新增的公共函数/service：无；Task 1 仅新增数据库结构。
- 后续需要抽取的重复逻辑：Task 2-3 应新增 `src/lib/editing/constants.ts`、`src/lib/editing/validation.ts`、`src/lib/editing/serializer.ts` 和 `src/services/editingConfigService.ts`，避免 route/UI 重复维护默认值、范围和字段映射。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/editing-config-schema.test.ts`: RED 阶段先失败 5/5，原因是 `editing_configs` 表、enum、约束、外键和索引不存在；GREEN 阶段通过 5/5。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma format`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma validate`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma migrate deploy`: 通过，已应用 `20260624112600_add_editing_configs`。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma generate`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 1。
- 是否满足对应 Acceptance Criteria：部分支撑 US-1/US-2/US-3 的“保存剪辑配置”底层数据结构；用户可用保存、授权拒绝、预览生成仍由后续 Task 2-10 完成。
- 是否允许勾选：允许勾选 Task 1，不允许勾选 Task 2-10。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行可从 `not_started` 调整为 `partial`，证据为剪辑配置数据表和 schema 验收已完成；缺口仍是 API、授权校验、preview Worker、UI 和最终导出。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 1 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-advanced-editing` Task 2。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 2: 实现剪辑配置查询 API

### 任务
- Spec: `voflow-advanced-editing`
- Task: 2
- Requirements: US-1、US-2、US-3

### 修改文件
- `src/lib/editing/constants.ts`
- `src/lib/editing/serializer.ts`
- `src/services/editingConfigService.ts`
- `src/app/api/video-jobs/[jobId]/editing-config/route.ts`
- `tests/editing-config-api.test.ts`
- `.kiro/specs/voflow-advanced-editing/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `GET /api/video-jobs/{jobId}/editing-config`，复用 `requireAuth()` 鉴权和统一 API response。
- 本次完成：新增 `getEditingConfigForJob()` service，先校验 job 属于当前 team；job 不存在或跨 team 时统一返回 404，避免泄露资源存在性。
- 本次完成：新增 `src/lib/editing/constants.ts` 收口默认字幕、BGM、画中画、背景、转场参数；无保存配置时返回默认剪辑配置。
- 本次完成：新增 `src/lib/editing/serializer.ts`，统一输出 `EditingConfig`、默认配置和可选 `previewArtifact`，route 不直接散写 Date/Json/Artifact 字段。
- 明确未完成：本轮未实现保存 API、保存参数 Zod 校验、素材授权校验、关键词高亮生成、剪辑预览 Worker、剪辑 UI 和最终导出参数传递。
- 是否使用 mock/provider/adapter 占位：否，本轮只实现查询 API 和默认配置返回；没有模拟外部服务。

### 工作区状态
- 开始前已有未提交改动：根目录 `AI_RULES.md` 迁移、`.kiro` 中开发规范路径替换、`voflow-video-render` Task 10-12 的 UI/测试/文档改动、`voflow-advanced-editing` Task 0-1 反馈、`prisma/schema.prisma`、`prisma/migrations/20260624112600_add_editing_configs/`、`tests/editing-config-schema.test.ts`、`docs/05-开发进度说明.md` 等。
- 本任务实际改动：新增剪辑配置查询 API、editing 常量/serializer/service、API 集成测试，并同步当前 task、总控 plan 和进度文档。
- 未触碰的既有改动：未修改前序 avatar render UI、worker、provider、acceptance/UI 测试实现；未回滚其他 spec 的规范路径替换。

### 硬编码检查
- 是否新增运行时硬编码：新增剪辑配置默认值，但已集中收口在 `src/lib/editing/constants.ts`，route/service/UI 没有散写。
- 新增配置是否收口：是，默认字幕、BGM ducking、pip position/size、voice/bgm volume、transition strength 全部由 `DEFAULT_EDITING_CONFIG` 提供。
- 新增错误码/状态/枚举是否收口：新增 `EDITING_JOB_NOT_FOUND`、`EDITING_CONFIG_QUERY_FAILED`，已收口到 `src/lib/editing/constants.ts`；未新增 UI 状态文案。

### 公共化检查
- 复用的公共模块：`src/lib/api-auth.ts`、`src/lib/api-response.ts`、`src/lib/db.ts`、Prisma `EditingConfig` / `Artifact` relation。
- 新增的公共函数/service：`serializeDefaultEditingConfig()`、`serializeEditingConfig()`、`getEditingConfigForJob()`。
- 后续需要抽取的重复逻辑：Task 3 保存 API 应复用本轮的 `DEFAULT_EDITING_CONFIG` 和 serializer，并新增 `src/lib/editing/validation.ts` 校验保存参数；Task 4-5 应继续复用 service 层封装素材授权校验。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/editing-config-api.test.ts`: RED 阶段先失败，原因是 `editing-config` route 不存在；GREEN 阶段通过 5/5，覆盖未登录、默认配置、已保存配置含 preview artifact、跨 team 404、不存在 job 404。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/editing-config-api.test.ts tests/editing-config-schema.test.ts`: 通过，2 个测试文件、10 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma validate`: 通过。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 2。
- 是否满足对应 Acceptance Criteria：部分支撑 US-1/US-2/US-3 的配置查询和默认配置能力；保存配置、授权拒绝、预览生成仍由后续 Task 3-10 完成。
- 是否允许勾选：允许勾选 Task 2，不允许勾选 Task 3-10。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行继续保持 `partial`，证据补充为查询 API 和默认配置返回已完成；缺口仍是保存 API、授权校验、preview Worker、UI 和最终导出。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 2 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-advanced-editing` Task 3。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 3: 实现剪辑配置保存 API

### 任务
- Spec: `voflow-advanced-editing`
- Task: 3
- Requirements: US-1、US-2、US-3

### 修改文件
- `src/lib/editing/constants.ts`
- `src/lib/editing/validation.ts`
- `src/services/editingConfigService.ts`
- `src/app/api/video-jobs/[jobId]/editing-config/route.ts`
- `tests/editing-config-api.test.ts`
- `.kiro/specs/voflow-advanced-editing/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `PUT /api/video-jobs/{jobId}/editing-config`，复用 `requireAuth()` 鉴权、统一 JSON 解析错误、Zod 校验错误和 API response。
- 本次完成：新增 `src/lib/editing/validation.ts`，统一校验字幕开关、关键词高亮、BGM ducking、画中画开关、画中画位置、画中画大小、人声/BGM 音量、转场强度和扩展 `configJson`。
- 本次完成：新增 `EDITING_RANGE_LIMITS`，把 `pipSize 10-60`、`volume 0-100`、`transitionStrength 0-100` 的运行时校验范围收口到 `src/lib/editing/constants.ts`。
- 本次完成：新增 `saveEditingConfigForJob()`，先校验 job 属于当前 team，再按 `jobId` upsert `editing_configs`；未传字段会沿用已有配置或 `DEFAULT_EDITING_CONFIG`。
- 本次完成：保存后返回统一 serializer 输出，保存结果可立即被 GET 查询到。
- 明确未完成：本轮未实现画中画素材授权校验、背景素材授权校验、关键词高亮自动生成、剪辑预览 Worker、剪辑 UI 和最终导出参数传递。
- 是否使用 mock/provider/adapter 占位：否，本轮只实现保存 API 和参数校验；没有模拟外部服务。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-2 的 Kiro 文档、`editing_configs` Prisma schema/migration/schema test、`GET /editing-config` route、editing constants/serializer/service、`tests/editing-config-api.test.ts`、`docs/05-开发进度说明.md` 等。
- 本任务实际改动：新增保存 API、保存参数校验、service upsert 逻辑，扩展 API 集成测试，并同步当前 task、总控 plan 和进度文档。
- 未触碰的既有改动：未修改前序 avatar render UI、worker、provider、acceptance/UI 测试实现；未回滚其他 spec 的规范路径替换。

### 硬编码检查
- 是否新增运行时硬编码：新增数值范围常量，但已集中收口到 `src/lib/editing/constants.ts` 的 `EDITING_RANGE_LIMITS`，route/service 没有散写。
- 新增配置是否收口：是，保存默认值复用 `DEFAULT_EDITING_CONFIG`，保存校验范围复用 `EDITING_RANGE_LIMITS`。
- 新增错误码/状态/枚举是否收口：新增 `EDITING_CONFIG_SAVE_FAILED`，已收口到 `src/lib/editing/constants.ts`；画中画位置继续复用 `EDITING_PIP_POSITIONS`。

### 公共化检查
- 复用的公共模块：`src/lib/api-auth.ts`、`src/lib/api-response.ts`、`src/lib/db.ts`、`src/lib/editing/constants.ts`、`src/lib/editing/serializer.ts`。
- 新增的公共函数/service：`saveEditingConfigSchema`、`saveEditingConfigForJob()`。
- 后续需要抽取的重复逻辑：Task 4-5 应在 service 层新增素材归属和授权校验，避免 route/UI 直接判断 `licenseStatus`；Task 6 应在 editing 公共层补关键词高亮配置生成。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/editing-config-api.test.ts`: RED 阶段新增 PUT 测试先失败 5/10，原因是 `PUT is not a function`；GREEN 阶段通过 10/10，覆盖未登录、保存后可查询、更新已有配置、参数越界校验、跨 team 404。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/editing-config-api.test.ts tests/editing-config-schema.test.ts`: 通过，2 个测试文件、15 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma validate`: 通过。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 3。
- 是否满足对应 Acceptance Criteria：部分支撑 US-1/US-2/US-3 的配置保存能力；未授权画中画/背景素材拒绝、关键词高亮生成、预览生成仍由后续 Task 4-10 完成。
- 是否允许勾选：允许勾选 Task 3，不允许勾选 Task 4-10。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行继续保持 `partial`，证据补充为保存 API 和范围校验已完成；缺口仍是素材授权校验、preview Worker、UI 和最终导出。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 3 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-advanced-editing` Task 4。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 4: 实现画中画素材授权校验

### 任务
- Spec: `voflow-advanced-editing`
- Task: 4
- Requirements: US-2

### 修改文件
- `src/lib/editing/constants.ts`
- `src/services/editingConfigService.ts`
- `src/app/api/video-jobs/[jobId]/editing-config/route.ts`
- `tests/editing-config-api.test.ts`
- `.kiro/specs/voflow-advanced-editing/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：保存剪辑配置时，如果 `pipEnabled=true`，必须提供 `pipAssetId`。
- 本次完成：`pipAssetId` 必须属于当前 `teamId`，且素材未删除；跨 team 或不存在的素材按未授权处理，避免泄露资源存在性。
- 本次完成：画中画素材必须通过现有 `assertAssetUsable(assetId, "video_generation")` 授权校验，覆盖 `licenseStatus=approved` 和授权 scope；未 approved、未授权 scope、找不到素材均拒绝保存。
- 本次完成：画中画素材类型限定为 `image` 或 `video`；音频等非图片/视频素材拒绝保存。
- 本次完成：新增 `PIP_ASSET_LICENSE_NOT_APPROVED` 和 `PIP_ASSET_TYPE_UNSUPPORTED`，错误码和文案统一收口到 `src/lib/editing/constants.ts`，PUT route 将两类业务错误返回 400。
- 明确未完成：本轮未实现背景素材授权校验、关键词高亮自动生成、剪辑预览 Worker、剪辑 UI、packaging-export 最终导出参数传递。
- 是否使用 mock/provider/adapter 占位：否，本轮复用真实数据库 asset/consent 数据和既有授权 helper，没有新增 mock provider。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-3 的 Kiro 文档、`editing_configs` Prisma schema/migration/schema test、剪辑配置 GET/PUT route、editing constants/serializer/validation/service、`tests/editing-config-api.test.ts`、`docs/05-开发进度说明.md` 等。
- 本任务实际改动：新增画中画素材归属、授权状态、授权 scope 和素材类型校验，扩展 API 集成测试，并同步当前 task、总控 plan 和进度文档。
- 未触碰的既有改动：未修改前序 avatar render UI、worker、provider、acceptance/UI 测试实现；未回滚其他 spec 的规范路径替换。

### 硬编码检查
- 是否新增运行时硬编码：新增画中画素材业务错误码和文案，但已集中收口到 `src/lib/editing/constants.ts`。
- 新增配置是否收口：画中画允许的素材类型目前在 `editingConfigService` 的授权校验函数内集中判断，route/UI 未散写；授权用途复用既有 `assertAssetUsable()` 和 `video_generation` scope。
- 新增错误码/状态/枚举是否收口：是，`PIP_ASSET_LICENSE_NOT_APPROVED`、`PIP_ASSET_TYPE_UNSUPPORTED` 已进入 `EDITING_ERROR_CODES` 和 `EDITING_ERROR_MESSAGES`。

### 公共化检查
- 复用的公共模块：`src/lib/assets/consent.ts`、`src/lib/api-auth.ts`、`src/lib/api-response.ts`、`src/lib/db.ts`、`src/lib/editing/constants.ts`、`src/lib/editing/validation.ts`、`src/lib/editing/serializer.ts`。
- 新增的公共函数/service：`validatePipAssetForSave()` 封装在 `src/services/editingConfigService.ts`，由保存 service 统一调用，避免 route/UI 直接判断 `licenseStatus`。
- 后续需要抽取的重复逻辑：Task 5 背景素材授权应复用同一类 service 层素材校验模式；如果画中画和背景校验继续出现重复，应再抽 `validateEditingAssetForSave()` 或等价 helper。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/editing-config-api.test.ts`: RED 阶段新增授权测试先失败 4/15，原因是保存 API 尚未拦截缺失、未 approved、跨 team 和非图片/视频画中画素材；GREEN 阶段通过 15/15。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/editing-config-api.test.ts tests/editing-config-schema.test.ts`: 通过，2 个测试文件、20 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma validate`: 通过。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 4。
- 是否满足对应 Acceptance Criteria：满足 US-2 中画中画素材必须属于当前 team、授权 approved 且未授权拒绝保存的要求；背景素材授权、预览和最终导出仍由后续 Task 完成。
- 是否允许勾选：允许勾选 Task 4，不允许勾选 Task 5-10。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行继续保持 `partial`，证据补充为画中画素材授权校验已完成；缺口仍是背景素材授权、关键词高亮生成、preview Worker、UI 和最终导出。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 4 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-advanced-editing` Task 5。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 5: 实现背景素材授权校验

### 任务
- Spec: `voflow-advanced-editing`
- Task: 5
- Requirements: US-3

### 修改文件
- `src/lib/editing/constants.ts`
- `src/services/editingConfigService.ts`
- `src/app/api/video-jobs/[jobId]/editing-config/route.ts`
- `tests/editing-config-api.test.ts`
- `.kiro/specs/voflow-advanced-editing/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：保存剪辑配置时，如果提供 `backgroundAssetId`，必须校验素材属于当前 `teamId` 且未删除；跨 team 或不存在的素材按未授权处理，避免泄露资源存在性。
- 本次完成：背景素材必须通过现有 `assertAssetUsable(assetId, "video_generation")` 授权校验，覆盖 `licenseStatus=approved` 和授权 scope；未 approved、未授权 scope、找不到素材均拒绝保存。
- 本次完成：背景素材类型限定为 `image` 或 `video`；音频等非图片/视频素材拒绝保存。
- 本次完成：新增 `BACKGROUND_ASSET_LICENSE_NOT_APPROVED` 和 `BACKGROUND_ASSET_TYPE_UNSUPPORTED`，错误码和文案统一收口到 `src/lib/editing/constants.ts`，PUT route 将两类业务错误返回 400。
- 本次完成：把 Task 4 的画中画素材校验和本轮背景素材校验合并为 `validateEditingAssetForSave()`，避免重复判断 `teamId`、`deletedAt`、素材类型、授权状态和 scope。
- 明确未完成：本轮未实现关键词高亮自动生成、剪辑预览 Worker、剪辑 UI、packaging-export 最终导出参数传递。
- 是否使用 mock/provider/adapter 占位：否，本轮复用真实数据库 asset/consent 数据和既有授权 helper，没有新增 mock provider。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-4 的 Kiro 文档、`editing_configs` Prisma schema/migration/schema test、剪辑配置 GET/PUT route、editing constants/serializer/validation/service、`tests/editing-config-api.test.ts`、`docs/05-开发进度说明.md` 等。
- 本任务实际改动：新增背景素材归属、授权状态、授权 scope 和素材类型校验，抽取通用编辑素材授权 helper，扩展 API 集成测试，并同步当前 task、总控 plan 和进度文档。
- 未触碰的既有改动：未修改前序 avatar render UI、worker、provider、acceptance/UI 测试实现；未回滚其他 spec 的规范路径替换。

### 硬编码检查
- 是否新增运行时硬编码：新增背景素材业务错误码和文案，但已集中收口到 `src/lib/editing/constants.ts`。
- 新增配置是否收口：背景允许的素材类型由 `validateEditingAssetForSave()` 集中判断，route/UI 未散写；授权用途复用既有 `assertAssetUsable()` 和 `video_generation` scope。
- 新增错误码/状态/枚举是否收口：是，`BACKGROUND_ASSET_LICENSE_NOT_APPROVED`、`BACKGROUND_ASSET_TYPE_UNSUPPORTED` 已进入 `EDITING_ERROR_CODES` 和 `EDITING_ERROR_MESSAGES`。

### 公共化检查
- 复用的公共模块：`src/lib/assets/consent.ts`、`src/lib/api-auth.ts`、`src/lib/api-response.ts`、`src/lib/db.ts`、`src/lib/editing/constants.ts`、`src/lib/editing/validation.ts`、`src/lib/editing/serializer.ts`。
- 新增的公共函数/service：`validateEditingAssetForSave()` 封装在 `src/services/editingConfigService.ts`，统一服务画中画和背景素材授权校验，避免 route/UI 直接判断 `licenseStatus`。
- 后续需要抽取的重复逻辑：Task 6 应在 editing 公共层补关键词高亮配置生成；Task 7 应新增 preview worker service 并复用 serializer/配置构建能力。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/editing-config-api.test.ts`: RED 阶段新增背景素材授权测试先失败 3/19，原因是保存 API 尚未拦截未 approved、跨 team 和非图片/视频背景素材；GREEN 阶段通过 19/19。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/editing-config-api.test.ts tests/editing-config-schema.test.ts`: 通过，2 个测试文件、24 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma validate`: 通过。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 5。
- 是否满足对应 Acceptance Criteria：满足 US-3 中背景图或背景视频必须校验素材授权的要求；关键词高亮、预览和最终导出仍由后续 Task 完成。
- 是否允许勾选：允许勾选 Task 5，不允许勾选 Task 6-10。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行继续保持 `partial`，证据补充为背景素材授权校验已完成；缺口仍是关键词高亮生成、preview Worker、UI 和最终导出。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 5 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-advanced-editing` Task 6。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 6: 实现关键词高亮配置生成

### 任务
- Spec: `voflow-advanced-editing`
- Task: 6
- Requirements: US-1

### 修改文件
- `src/lib/editing/constants.ts`
- `src/lib/editing/keyword-highlight.ts`
- `src/services/editingConfigService.ts`
- `tests/editing-keyword-highlight.test.ts`
- `tests/editing-config-api.test.ts`
- `.kiro/specs/voflow-advanced-editing/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `src/lib/editing/keyword-highlight.ts`，从确认文案中提取去重后的高亮关键词，默认最多 5 个。
- 本次完成：新增 ASS 可用高亮样式配置 `KeywordHighlight`，包含 `primaryColor`、`outlineColor` 和 `bold`，样式常量收口到 `src/lib/editing/constants.ts`。
- 本次完成：保存剪辑配置时读取当前 job 绑定的 `approved` script，按 `keywordHighlightEnabled` 生成 `configJson.keywordHighlight`；开启时写入关键词，关闭时写入空关键词并保留 disabled 状态。
- 本次完成：保存时保留调用方已有 `configJson` 其他字段，例如 `subtitleStyle`，并用服务端生成的 `keywordHighlight` 覆盖同名字段，避免前端伪造关键词配置。
- 明确未完成：本轮未实现剪辑预览 Worker、剪辑 UI、packaging-export 最终导出参数传递。
- 是否使用 mock/provider/adapter 占位：否，本轮为纯 helper 和保存 service 行为，没有外部 provider。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-5 的 Kiro 文档、`editing_configs` Prisma schema/migration/schema test、剪辑配置 GET/PUT route、editing constants/serializer/validation/service、`tests/editing-config-api.test.ts`、`docs/05-开发进度说明.md` 等。
- 本任务实际改动：新增关键词高亮公共 helper、ASS 样式常量、保存时的 `configJson.keywordHighlight` 生成逻辑、helper/API 测试，并同步当前 task、总控 plan 和进度文档。
- 未触碰的既有改动：未修改前序 avatar render UI、worker、provider、acceptance/UI 测试实现；未回滚其他 spec 的规范路径替换。

### 硬编码检查
- 是否新增运行时硬编码：新增关键词数量和 ASS 样式值，但已集中收口到 `src/lib/editing/constants.ts`。
- 新增配置是否收口：是，`EDITING_KEYWORD_HIGHLIGHT_LIMITS` 和 `EDITING_KEYWORD_HIGHLIGHT_ASS_STYLE` 由公共 helper 复用，route/UI 未散写。
- 新增错误码/状态/枚举是否收口：本轮未新增错误码；新增的 `KeywordHighlight` 样式名收口在 editing 常量模块。

### 公共化检查
- 复用的公共模块：`src/lib/editing/constants.ts`、`src/lib/editing/validation.ts`、`src/lib/editing/serializer.ts`、`src/lib/db.ts`。
- 新增的公共函数/service：`extractHighlightKeywords()`、`buildKeywordHighlightConfig()`；保存 service 新增 `buildConfigJsonForSave()` 负责合并服务端生成的高亮配置。
- 后续需要抽取的重复逻辑：Task 7 preview Worker 应复用 `configJson.keywordHighlight` 和 serializer，不应重新提取关键词或散写 ASS 样式。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/editing-keyword-highlight.test.ts tests/editing-config-api.test.ts`: RED 阶段先失败，原因是 `src/lib/editing/keyword-highlight.ts` 不存在且保存 API 未生成 `configJson.keywordHighlight`；GREEN 阶段通过，2 个测试文件、25 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/editing-keyword-highlight.test.ts tests/editing-config-api.test.ts tests/editing-config-schema.test.ts`: 通过，3 个测试文件、30 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma validate`: 通过。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 6。
- 是否满足对应 Acceptance Criteria：满足 US-1 中开启关键词高亮时标记关键词并输出 ASS 字幕可用样式配置；实际预览展示和最终字幕烧录仍由 Task 7、Task 8 和 packaging-export 完成。
- 是否允许勾选：允许勾选 Task 6，不允许勾选 Task 7-10。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行继续保持 `partial`，证据补充为关键词高亮配置生成已完成；缺口仍是 preview Worker、UI 和最终导出。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 6 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-advanced-editing` Task 7。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 7: 实现剪辑预览 Worker

### 任务
- Spec: `voflow-advanced-editing`
- Task: 7
- Requirements: US-3

### 修改文件
- `src/lib/editing/constants.ts`
- `src/services/editingPreviewWorkerService.ts`
- `src/services/workflowWorkerService.ts`
- `tests/editing-preview-worker.test.ts`
- `.kiro/specs/voflow-advanced-editing/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `createEditingPreviewWorkflowNodeHandler()`，注册到默认 workflow handlers 的 `editing_preview` 节点。
- 本次完成：Worker 读取当前 job 的已保存 `EditingConfig`，序列化为轻量预览配置 JSON，并通过 `uploadJobArtifact()` 上传到 job artifact 路径。
- 本次完成：Worker 通过 `writeWorkflowArtifact()` 写入 `editing_preview` artifact，并回写 `editing_configs.previewArtifactId`。
- 本次完成：Worker 输出 `WAITING_APPROVAL`，保留预览确认语义，并在缺失剪辑配置时抛出稳定 `EDITING_PREVIEW_FAILED`。
- 明确未完成：本轮未用 FFmpeg 生成低清 MP4 预览；当前按设计允许先返回轻量预览配置 artifact。视频剪辑 UI、预览创建 API 和最终导出参数传递仍由后续任务完成。
- 是否使用 mock/provider/adapter 占位：是，预览输出为轻量配置 JSON artifact，不是真实低清视频；不能按真实 FFmpeg 低清预览验收。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-6 的 Kiro 文档、剪辑配置 GET/PUT route、editing constants/serializer/validation/keyword-highlight/service、`tests/editing-config-api.test.ts`、`tests/editing-keyword-highlight.test.ts`、`docs/05-开发进度说明.md` 等。
- 本任务实际改动：新增 editing preview worker service、workflow handler 注册、preview artifact 常量、worker 测试，并同步当前 task、总控 plan 和进度文档。
- 未触碰的既有改动：未修改前序 avatar render UI、worker、provider、acceptance/UI 测试实现；未回滚其他 spec 的规范路径替换。

### 硬编码检查
- 是否新增运行时硬编码：新增 preview artifact 类型、content type、文件扩展名和错误码，但已集中收口到 `src/lib/editing/constants.ts`。
- 新增配置是否收口：是，`EDITING_PREVIEW_NODE_TYPE`、`EDITING_PREVIEW_ARTIFACT_TYPE`、`EDITING_PREVIEW_CONTENT_TYPE`、`EDITING_PREVIEW_FILE_EXTENSION` 由 Worker 复用。
- 新增错误码/状态/枚举是否收口：是，`EDITING_PREVIEW_FAILED` 已进入 `EDITING_ERROR_CODES` 和 `EDITING_ERROR_MESSAGES`；workflow 状态复用 `WORKFLOW_NODE_STATUS.WAITING_APPROVAL`。

### 公共化检查
- 复用的公共模块：`src/lib/storage.ts` 的 `uploadJobArtifact()`、`src/services/workflowArtifactService.ts` 的 `writeWorkflowArtifact()`、`src/lib/editing/serializer.ts`、`src/lib/workflow/status.ts`。
- 新增的公共函数/service：`createEditingPreviewWorkflowNodeHandler()`、`EditingPreviewWorkerError`。
- 后续需要抽取的重复逻辑：Task 8 UI 和后续 packaging-export 应复用 `previewArtifactId` 和 `editing_preview` artifact，不应重新拼 artifact 路径或直接访问底层存储。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/editing-preview-worker.test.ts`: RED 阶段先失败，原因是 `editingPreviewWorkerService` 不存在；GREEN 阶段通过，1 个测试文件、3 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/editing-preview-worker.test.ts tests/editing-keyword-highlight.test.ts tests/editing-config-api.test.ts tests/editing-config-schema.test.ts`: 通过，4 个测试文件、33 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma validate`: 通过。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 7 的“可先返回轻量预览配置、保存 preview artifact”边界。
- 是否满足对应 Acceptance Criteria：部分满足 US-3 的“点击剪辑预览生成低成本预览或返回预览配置”；当前返回轻量预览配置 artifact，真实低清 MP4 预览未实现。
- 是否允许勾选：允许勾选 Task 7，不允许勾选 Task 8-10。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行继续保持 `partial`，证据补充为轻量剪辑预览 Worker 已完成；缺口仍是 UI、配置传递给最终导出和 packaging-export。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 7 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-advanced-editing` Task 8。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界；轻量预览配置属于 Task 7 原说明允许范围。

### Task 8: 实现视频剪辑 UI

### 任务
- Spec: `voflow-advanced-editing`
- Task: 8
- Requirements: US-1、US-2、US-3

### 修改文件
- `src/lib/editing/ui.ts`
- `src/components/editing/EditingConfigPanel.tsx`
- `src/services/editingPreviewTaskService.ts`
- `src/app/api/video-jobs/[jobId]/editing-preview/route.ts`
- `src/app/dashboard/voices/page.tsx`
- `tests/editing-ui.test.tsx`
- `tests/editing-preview-task-service.test.ts`
- `.kiro/specs/voflow-advanced-editing/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `EditingConfigPanel`，展示字幕开关、关键词高亮、BGM 自动闪避、画中画开关、画中画素材、画中画位置/大小、背景素材、人声音量、BGM 音量、转场强度、保存按钮和剪辑预览按钮。
- 本次完成：新增 `src/lib/editing/ui.ts`，集中维护画中画位置 label/options 和剪辑 UI range 配置，避免 UI 直接散写枚举和范围。
- 本次完成：将剪辑面板接入现有 `/dashboard/voices` 工作台；选中视频任务后加载 `/editing-config` 和 approved 素材，保存走 PUT `/editing-config`，预览走 POST `/editing-preview`。
- 本次完成：新增 `createEditingPreviewTask()` 和 `POST /api/video-jobs/{jobId}/editing-preview`，用于从 UI 创建 `editing_preview` workflow node 并投递队列；实际预览 artifact 生成仍由 Task 7 Worker 负责。
- 明确未完成：本轮未实现真实 FFmpeg 低清视频预览；最终导出参数传递和 packaging-export 仍未实现。
- 是否使用 mock/provider/adapter 占位：UI 使用真实 API；预览链路仍是轻量配置 artifact，不是真实低清视频。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-7 的 Kiro 文档、editing constants/serializer/validation/keyword-highlight/service、剪辑配置 API、editing preview Worker、相关 tests、`docs/05-开发进度说明.md` 等。
- 本任务实际改动：新增剪辑 UI 组件、editing UI 公共 label/range、预览任务创建 service/API、工作台接入、UI/service 测试，并同步当前 task、总控 plan 和进度文档。
- 未触碰的既有改动：未修改前序 avatar render worker/provider/output-validation；未回滚其他 spec 的规范路径替换。

### 硬编码检查
- 是否新增运行时硬编码：新增 UI label，但已集中收口到 `src/lib/editing/ui.ts`；预览 node/artifact/content type 复用 `src/lib/editing/constants.ts`。
- 新增配置是否收口：是，画中画位置、控件范围、预览 artifact 类型、预览 content type 均由公共模块提供。
- 新增错误码/状态/枚举是否收口：未新增新的错误码；预览任务创建复用 `EDITING_PREVIEW_FAILED` 和 `EDITING_JOB_NOT_FOUND`。

### 公共化检查
- 复用的公共模块：`src/lib/editing/constants.ts`、`src/lib/editing/ui.ts`、`src/lib/editing/serializer.ts`、`src/lib/api-auth.ts`、`src/lib/api-response.ts`、`src/lib/queue/adapter.ts`、`src/lib/workflow/trace.ts`。
- 新增的公共函数/service：`EditingConfigPanel`、`createEditingPreviewTask()`。
- 后续需要抽取的重复逻辑：Task 10 checkpoint 需要确认 UI、API、Worker 与最终导出参数口径一致；packaging-export 应复用 `editing_configs` 和 `configJson.keywordHighlight`，不要重新定义剪辑参数。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/editing-ui.test.tsx`: RED 阶段先失败，原因是 `EditingConfigPanel` 不存在；GREEN 阶段通过，1 个测试文件、2 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/editing-preview-task-service.test.ts`: RED 阶段先失败，原因是 `editingPreviewTaskService` 不存在；GREEN 阶段通过，1 个测试文件、2 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/editing-ui.test.tsx tests/editing-preview-task-service.test.ts tests/editing-preview-worker.test.ts tests/editing-keyword-highlight.test.ts tests/editing-config-api.test.ts tests/editing-config-schema.test.ts tests/avatar-render-ui.test.tsx`: 通过，7 个测试文件、40 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma validate`: 通过。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过，`/api/video-jobs/[jobId]/editing-preview` 已进入构建路由列表，`/dashboard/voices` bundle 更新。

### 验收结论
- 是否满足当前 task：满足 Task 8。
- 是否满足对应 Acceptance Criteria：满足 US-1/US-2/US-3 中用户可配置字幕、关键词高亮、BGM ducking、画中画、背景、音量和转场，并可保存和创建剪辑预览任务；真实低清视频预览和最终导出仍由后续任务/spec 完成。
- 是否允许勾选：允许勾选 Task 8，不允许勾选 Task 9-10。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行继续保持 `partial`，证据补充为视频剪辑 UI 已接入工作台；缺口仍是 Task 9 测试补齐、Task 10 checkpoint 和 packaging-export。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 8 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-advanced-editing` Task 9。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 9: 添加测试

### 任务
- Spec: `voflow-advanced-editing`
- Task: 9
- Requirements: US-1、US-2、US-3

### 修改文件
- `tests/editing-preview-worker.test.ts`
- `.kiro/specs/voflow-advanced-editing/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：复核 Task 9 要求的测试覆盖，确认“未授权画中画素材被拒绝”已由 `tests/editing-config-api.test.ts` 覆盖。
- 本次完成：确认“音量越界被拒绝”已由 `tests/editing-config-api.test.ts` 覆盖。
- 本次完成：确认“保存配置后可查询”已由 `tests/editing-config-api.test.ts` 覆盖。
- 本次完成：新增 `executeWorkflowNode()` 级测试，确认剪辑预览缺少配置时会将 workflow node 标记为 `failed`，并写入稳定 `EDITING_PREVIEW_FAILED` 错误。
- 明确未完成：本轮未进入 packaging-export；真实 FFmpeg 低清预览仍未实现。
- 是否使用 mock/provider/adapter 占位：测试覆盖当前轻量预览配置 artifact 能力和失败落库；未声称真实 FFmpeg 预览完成。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-8 的 Kiro 文档、剪辑配置 API/service/UI、editing preview Worker/task service/API、相关 tests、`docs/05-开发进度说明.md` 等。
- 本任务实际改动：补齐剪辑预览失败落库测试，并同步当前 task、总控 plan 和进度文档。
- 未触碰的既有改动：未修改前序 avatar render worker/provider/output-validation；未回滚其他 spec 的规范路径替换。

### 硬编码检查
- 是否新增运行时硬编码：否，本轮只新增测试断言和文档。
- 新增配置是否收口：无新增配置。
- 新增错误码/状态/枚举是否收口：测试复用已收口的 `EDITING_PREVIEW_FAILED` 和 `WORKFLOW_NODE_STATUS.FAILED`。

### 公共化检查
- 复用的公共模块：`src/services/workflowWorkerService.ts`、`src/lib/editing/constants.ts`、`src/lib/workflow/status.ts`。
- 新增的公共函数/service：无。
- 后续需要抽取的重复逻辑：Task 10 checkpoint 需按 requirements/design/tasks 逐项验收，并同步总控矩阵后才能进入 packaging-export。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/editing-preview-worker.test.ts tests/editing-config-api.test.ts`: 通过，2 个测试文件、25 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/editing-ui.test.tsx tests/editing-preview-task-service.test.ts tests/editing-preview-worker.test.ts tests/editing-keyword-highlight.test.ts tests/editing-config-api.test.ts tests/editing-config-schema.test.ts`: 通过，6 个测试文件、38 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma validate`: 通过。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 9。
- 是否满足对应 Acceptance Criteria：测试覆盖 US-1/US-2/US-3 的配置保存、授权拒绝、范围校验、预览失败落库和 UI/Worker 基础能力。
- 是否允许勾选：允许勾选 Task 9，不允许勾选 Task 10。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行继续保持 `partial`，下一步是 Task 10 checkpoint。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 9 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-advanced-editing` Task 10。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 10: Checkpoint 高级剪辑验收

### 任务
- Spec: `voflow-advanced-editing`
- Task: 10
- Requirements: US-1、US-2、US-3

### 修改文件
- `.kiro/specs/voflow-advanced-editing/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：逐条复核 Task 0-9，确认剪辑配置数据表、查询 API、保存 API、画中画授权、背景授权、关键词高亮配置、轻量预览 Worker、视频剪辑 UI 和测试补齐均有实现与验证记录。
- 本次完成：确认用户可保存字幕/BGM ducking/画中画/背景/音量/转场配置，配置可被 GET 查询，并可从 `/dashboard/voices` 工作台保存和创建轻量剪辑预览任务。
- 本次完成：确认未授权、跨 team、未 approved、scope 不匹配或非图片/视频素材不能用于画中画或背景。
- 本次完成：确认 `editing_preview` Worker 会生成轻量预览配置 JSON artifact，写入 `editing_preview` artifact，回写 `previewArtifactId`，并进入 `waiting_approval`。
- 明确未完成：真实 FFmpeg 低清 MP4 预览未实现；配置传递到最终 FFmpeg 合成、最终 MP4、封面、下载属于 `voflow-packaging-export`。
- 是否使用 mock/provider/adapter 占位：是，预览为轻量配置 artifact，不是真实低清视频；checkpoint 不把它标记为真实 FFmpeg 预览能力。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-9 的 Kiro 文档、剪辑配置 API/service/UI、editing preview Worker/task service/API、相关 tests、`docs/05-开发进度说明.md` 等。
- 本任务实际改动：仅更新 checkpoint 勾选、执行反馈、总控 plan 和进度文档。
- 未触碰的既有改动：未修改前序 avatar render worker/provider/output-validation；未回滚其他 spec 的规范路径替换。

### 硬编码检查
- 是否新增运行时硬编码：否，本轮只更新文档；本 Spec 新增的错误码、preview artifact 常量、关键词高亮样式和 UI label/range 已收口在 `src/lib/editing/constants.ts` / `src/lib/editing/ui.ts`。
- 新增配置是否收口：是，剪辑默认值、范围、关键词高亮、预览 artifact、画中画位置和 UI label 均已收口。
- 新增错误码/状态/枚举是否收口：是，`EDITING_*`、`PIP_*`、`BACKGROUND_*` 和 `EDITING_PREVIEW_FAILED` 已收口；workflow 状态复用公共状态模块。

### 公共化检查
- 复用的公共模块：`src/lib/api-auth.ts`、`src/lib/api-response.ts`、`src/lib/assets/consent.ts`、`src/lib/storage.ts`、`src/lib/workflow/status.ts`、`src/services/workflowArtifactService.ts`。
- 新增的公共函数/service：`src/lib/editing/constants.ts`、`src/lib/editing/validation.ts`、`src/lib/editing/serializer.ts`、`src/lib/editing/keyword-highlight.ts`、`src/lib/editing/ui.ts`、`src/services/editingConfigService.ts`、`src/services/editingPreviewWorkerService.ts`、`src/services/editingPreviewTaskService.ts`、`src/components/editing/EditingConfigPanel.tsx`。
- 后续需要抽取的重复逻辑：`voflow-packaging-export` 应复用 `editing_configs`、`configJson.keywordHighlight`、画中画/背景参数和 `previewArtifactId`，不要重新定义剪辑配置结构。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/editing-ui.test.tsx tests/editing-preview-task-service.test.ts tests/editing-preview-worker.test.ts tests/editing-keyword-highlight.test.ts tests/editing-config-api.test.ts tests/editing-config-schema.test.ts`: 通过，6 个测试文件、38 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma validate`: 通过。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过，包含 `/api/video-jobs/[jobId]/editing-preview` 和更新后的 `/dashboard/voices`。

### 验收结论
- 是否满足当前 task：满足 Task 10 checkpoint。
- 是否满足对应 Acceptance Criteria：US-1、US-2、US-3 在高级剪辑配置、授权拒绝、关键词配置、轻量预览和 UI 层面满足；真实 FFmpeg 预览和最终 MP4 合成不属于本 Spec 完成口径，进入 `voflow-packaging-export`。
- 是否允许勾选：允许勾选 Task 10；`voflow-advanced-editing` Task 0-10 全部完成。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行仍为 `partial`，原因是 packaging-export 未开始，最终 MP4 合成和下载未完成。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 10 并追加 checkpoint 反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-packaging-export` Task 0。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。
