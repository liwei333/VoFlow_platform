# Tasks: voflow-video-render

## Implementation Plan

- [x] 0. 执行后续开发规范检查
  - 先阅读 `docs/03-VoFlow开发执行规范.md`
  - 本 Spec 不得在 Worker、API 或 UI 中散写渲染服务地址、预览/高清分辨率、crop 选项、错误码、状态文案或 artifact 路径
  - Avatar 服务 baseUrl、服务状态、状态文案和健康检查必须复用 `voflow-local-model-monitor` 的 `avatar` 服务注册表、配置 helper、health adapter 和 API
  - Avatar render provider、输入校验、ffprobe 校验、artifact 写入和 API 响应必须进入公共 helper/service
  - 若发现同类逻辑已经重复两处以上，先抽公共函数或公共常量，再继续业务实现
  - Checkpoint 反馈必须包含硬编码检查、公共函数提取情况和验证命令
  - _Requirements: US-1, US-2, US-3, US-4_

- [ ] 1. 创建渲染请求数据库迁移
  - 创建 `avatar_render_requests`
  - 添加 mode、crop、aspect_ratio 校验
  - 关联 job、node、avatar、audio artifact
  - _Requirements: US-1, US-4_

- [ ] 2. 定义 Avatar Render Provider 接口
  - `renderAvatarVideo(payload)`
  - 返回视频路径、duration、resolution、model
  - 实现 mock provider 生成可播放测试视频
  - provider 只消费 `avatar` 服务的 `baseUrl` 和业务渲染参数，不直接读取 `AVATAR_BASE_URL`
  - _Requirements: US-2, US-3_

- [ ] 3. 实现渲染输入校验服务
  - 校验 avatar ready
  - 校验 avatar license approved
  - 校验 TTS audio artifact 存在
  - 校验 aspectRatio 与项目一致
  - _Requirements: US-1, US-4_

- [ ] 4. 实现预览渲染 API
  - 创建 preview render request
  - 投递 avatar_render 节点
  - 设置 renderOptions resolution 为低清
  - _Requirements: US-2, US-4_

- [ ] 5. 实现 Avatar Render Worker
  - 下载 source image 和 audio
  - 调用 provider
  - 上传 avatar_video 到对象存储
  - 写入 artifact
  - _Requirements: US-2, US-3_

- [ ] 6. 实现输出视频校验
  - 校验文件存在且大小大于阈值
  - 使用 ffprobe 校验 duration 和 video stream
  - 失败时返回 invalid output 错误
  - _Requirements: US-2, US-3_

- [ ] 7. 实现预览确认流程
  - 预览成功后节点 waiting_approval
  - 用户确认后创建 hd request
  - 用户不满意时允许重试 preview
  - _Requirements: US-2, US-3_

- [ ] 8. 实现高清渲染 API
  - 只允许在 preview approved 后调用
  - 创建 hd 版本请求
  - 投递高清渲染任务
  - _Requirements: US-3_

- [ ] 9. 接入真实模型服务配置
  - 从 `local_model_services` 读取 `avatar` 服务的 `baseUrl` 和 `status`
  - 不在渲染模块重新读取或定义 `AVATAR_BASE_URL`
  - 实现请求超时和错误码映射
  - 保留 mock provider 作为测试 fallback
  - _Requirements: US-2, US-3_

- [ ] 10. 实现数字人选择和渲染 UI
  - 展示我的数字人列表
  - 展示画面比例和裁剪选项
  - 展示预览播放器和确认按钮
  - _Requirements: US-1, US-2, US-4_

- [ ] 11. 添加测试
  - avatar not ready 被拒绝
  - audio artifact 缺失被拒绝
  - mock provider 输出 artifact
  - invalid output 标记节点失败
  - _Requirements: US-1, US-2, US-3, US-4_

- [ ] 12. Checkpoint: 数字人渲染验收
  - 用户选择我的数字人和 TTS 音频
  - 系统生成可播放低清预览
  - 用户确认后生成高清中间视频
  - 失败任务可重试且历史版本保留
  - _Requirements: US-1, US-2, US-3, US-4_

## 执行反馈

### Task 0: 后续开发规范检查与任务执行判断

### 任务
- Spec: `voflow-video-render`
- Task: 0
- Requirements: US-1、US-2、US-3、US-4

### 修改文件
- `.kiro/specs/voflow-video-render/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`

### 范围说明
- 本次完成：读取并对照 `docs/03-VoFlow开发执行规范.md`，确认 `voflow-video-render` 的 `requirements.md`、`design.md`、`tasks.md` 已存在，且总控计划已允许从声音克隆 checkpoint 后进入本 Spec。
- 本次完成：复核现有公共基础，确认 `avatar_render` workflow node 已在 `src/lib/workflow/constants.ts` 中定义，`avatar` 本地模型服务已在 `src/lib/local-model/config.ts` 和 `src/services/localModelService.ts` 中注册，artifact 写库已有 `writeWorkflowArtifact()`，对象存储路径已有 `buildJobArtifactPath()` / `uploadJobArtifact()`。
- 当前任务执行判断：Task 1 是下一个可执行任务，应先创建 `avatar_render_requests` 数据表和 migration，关联 job、node、avatar、TTS audio artifact，并添加 mode、crop、aspectRatio 的数据库与测试约束。
- 明确未完成：本轮未创建数据库表、未实现 provider、未实现输入校验 service、未实现 API、未实现 Worker、未实现 UI。
- 是否使用 mock/provider/adapter 占位：本轮未实现运行时代码；后续 Task 2 可实现 mock provider 打通流程，但必须在执行反馈中标注 mock 边界，不能按真实 MuseTalk/SadTalker 能力验收。

### 规范检查结论
- 渲染服务配置：后续不得在 render provider、Worker 或 API 中直接读取 `AVATAR_BASE_URL`；必须从 `local_model_services` 读取 `serviceType=avatar` 的 `baseUrl`、`status`、`modelName`、`lastError`，并复用本地模型健康检查与状态文案。
- provider 边界：后续应新增 Avatar Render Provider 接口，例如 `renderAvatarVideo(payload)`，provider 只消费已经归一化的 avatar service config 和业务渲染参数，不维护第二套服务地址、状态或健康检查。
- 输入校验边界：后续应在 service 层校验 avatar ready、avatar license approved、TTS audio artifact 存在、aspectRatio 与项目一致、crop/mode 合法；route 只保留鉴权、JSON 解析和 service 调用。
- artifact 写入边界：Worker 上传视频产物必须复用 `uploadJobArtifact()` / `buildJobArtifactPath(teamId, jobId, "avatar_render")`，写库必须复用或扩展 `writeWorkflowArtifact()`，artifact type 使用 `avatar_video` 口径并通过 serializer 输出签名 URL。
- API 响应边界：新增 API 必须复用 `requireAuth`、`success()`、`validationError()`、`notFound()`、`internalError()` 和 Zod 校验；错误码、状态文案、mode/crop/resolution 选项应收口到 `src/lib/avatar-render/*` 常量/validation/ui 模块。
- Worker 边界：后续 `avatar_render` handler 应注册到 `createDefaultWorkflowNodeHandlers()`，payload 继续使用 `jobId`、`nodeId`、`nodeType`、`version`、`traceId`；失败时写入节点 error，保持 retryable 语义。

### 硬编码检查
- 是否新增运行时硬编码：否，本轮只更新 Kiro 状态文档。
- 新增配置是否收口：本轮未新增配置；后续如果新增 preview/hd resolution、crop、mode、provider timeout、ffprobe 阈值，必须收口到 avatar render 常量/config 模块。
- 新增错误码/状态/枚举是否收口：本轮未新增；后续 `AVATAR_NOT_READY`、`TTS_AUDIO_NOT_FOUND`、`AVATAR_PROVIDER_UNAVAILABLE`、`AVATAR_RENDER_INVALID_OUTPUT` 等错误码应统一收口，route/worker 不散写。

### 公共化检查
- 复用的公共模块：`src/lib/workflow/constants.ts`、`src/lib/workflow/status.ts`、`src/services/workflowWorkerService.ts`、`src/services/workflowArtifactService.ts`、`src/lib/storage.ts`、`src/lib/local-model/config.ts`、`src/lib/local-model/health.ts`、`src/services/localModelService.ts`、`src/services/avatarService.ts`、`src/services/ttsResultService.ts`、统一 API response 和 `requireAuth`。
- 新增的公共函数/service：无。
- 后续需要抽取的重复逻辑：Task 1-4 应新增 `src/lib/avatar-render/constants.ts`、`src/lib/avatar-render/validation.ts`、`src/services/avatarRenderService.ts`；Task 5-6 应新增 provider/worker/output validation helper，避免 API、Worker、UI 重复维护 mode/crop/resolution/error 文案。

### 验证命令
- `rg -n "avatar_render|avatar|local_model|buildJobArtifactPath|writeWorkflowArtifact|TTS_AUDIO|AVATAR" src prisma tests .env.example package.json`: 通过，确认已有 workflow/local-model/storage/artifact/avatar/TTS 基础能力。
- `npm run test:run -- tests/workflow-constants.test.ts tests/local-model-service.test.ts tests/local-model-config.test.ts tests/storage.test.ts tests/workflow-worker-artifact-service.test.ts tests/avatar-api.test.ts tests/tts-result-service.test.ts`: 未通过，原因是本地 MinIO 未启动，`tests/storage.test.ts` 连接 `localhost:9000` 返回 `ECONNREFUSED`；该失败属于环境前置，不是 Task 0 文档检查失败。
- `curl -fsS http://localhost:9000/minio/health/live`: 未通过，确认当前 MinIO 健康检查不可达。
- `npm run test:run -- tests/workflow-constants.test.ts tests/local-model-service.test.ts tests/local-model-config.test.ts tests/workflow-worker-artifact-service.test.ts tests/avatar-api.test.ts tests/tts-result-service.test.ts`: 通过，6 files / 44 tests。
- `npm run lint`: 通过。
- `npm run build`: 通过。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 0。
- 是否满足对应 Acceptance Criteria：满足启动 `voflow-video-render` 前的开发规范检查、公共化边界确认和任务执行判断；US-1 到 US-4 的业务实现从 Task 1 开始。
- 是否允许勾选：允许勾选 Task 0，不允许勾选 Task 1-12。
- MVP 状态矩阵是否需要同步更新：需要，`voflow-video-render` 从 `not_started` 进入 `partial`，下一步为 Task 1 创建渲染请求数据库迁移。
