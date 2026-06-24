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

- [ ] 2. 实现剪辑配置查询 API
  - 返回默认字幕、BGM、画中画、背景、转场配置
  - 若未配置则生成默认值
  - _Requirements: US-1, US-2, US-3_

- [ ] 3. 实现剪辑配置保存 API
  - 保存字幕开关和关键词高亮
  - 保存画中画参数
  - 保存音量和转场参数
  - _Requirements: US-1, US-2, US-3_

- [ ] 4. 实现画中画素材授权校验
  - 校验 pip_asset_id 属于当前 team
  - 校验 license_status approved
  - 未授权时拒绝保存
  - _Requirements: US-2_

- [ ] 5. 实现背景素材授权校验
  - 支持背景图和背景视频
  - 校验素材授权
  - 记录背景素材引用
  - _Requirements: US-3_

- [ ] 6. 实现关键词高亮配置生成
  - 从确认文案中提取关键词
  - 允许用户开关高亮
  - 输出 ASS 字幕可用样式配置
  - _Requirements: US-1_

- [ ] 7. 实现剪辑预览 Worker
  - 可先返回轻量预览配置
  - 后续用 FFmpeg 生成低清预览
  - 保存 preview artifact
  - _Requirements: US-3_

- [ ] 8. 实现视频剪辑 UI
  - 字幕开关、关键词高亮、BGM 自动闪避
  - 画中画开关、大小和位置
  - 人声/BGM 音量、转场强度
  - 剪辑预览按钮
  - _Requirements: US-1, US-2, US-3_

- [ ] 9. 添加测试
  - 未授权画中画素材被拒绝
  - 音量越界被拒绝
  - 保存配置后可查询
  - 预览失败写入错误
  - _Requirements: US-1, US-2, US-3_

- [ ] 10. Checkpoint: 高级剪辑验收
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
