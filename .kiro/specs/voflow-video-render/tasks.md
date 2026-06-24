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

- [x] 1. 创建渲染请求数据库迁移
  - 创建 `avatar_render_requests`
  - 添加 mode、crop、aspect_ratio 校验
  - 关联 job、node、avatar、audio artifact
  - _Requirements: US-1, US-4_

- [x] 2. 定义 Avatar Render Provider 接口
  - `renderAvatarVideo(payload)`
  - 返回视频路径、duration、resolution、model
  - 实现 mock provider 生成可播放测试视频
  - provider 只消费 `avatar` 服务的 `baseUrl` 和业务渲染参数，不直接读取 `AVATAR_BASE_URL`
  - _Requirements: US-2, US-3_

- [x] 3. 实现渲染输入校验服务
  - 校验 avatar ready
  - 校验 avatar license approved
  - 校验 TTS audio artifact 存在
  - 校验 aspectRatio 与项目一致
  - _Requirements: US-1, US-4_

- [x] 4. 实现预览渲染 API
  - 创建 preview render request
  - 投递 avatar_render 节点
  - 设置 renderOptions resolution 为低清
  - _Requirements: US-2, US-4_

- [x] 5. 实现 Avatar Render Worker
  - 下载 source image 和 audio
  - 调用 provider
  - 上传 avatar_video 到对象存储
  - 写入 artifact
  - _Requirements: US-2, US-3_

- [x] 6. 实现输出视频校验
  - 校验文件存在且大小大于阈值
  - 使用 ffprobe 校验 duration 和 video stream
  - 失败时返回 invalid output 错误
  - _Requirements: US-2, US-3_

- [x] 7. 实现预览确认流程
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

### Task 1: 渲染请求数据库迁移

### 任务
- Spec: `voflow-video-render`
- Task: 1
- Requirements: US-1、US-4

### 修改文件
- `prisma/schema.prisma`
- `prisma/migrations/20260623145600_add_avatar_render_requests/migration.sql`
- `tests/avatar-render-schema.test.ts`
- `.kiro/specs/voflow-video-render/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`

### 范围说明
- 本次完成：新增 `AvatarRenderMode` 枚举，限定 `preview`、`hd` 两种渲染模式。
- 本次完成：新增 `AvatarRenderCrop` 枚举，限定 `head`、`half_body` 两种裁剪模式。
- 本次完成：新增 `AvatarRenderRequest` Prisma model，并映射到 `avatar_render_requests` 表。
- 本次完成：请求表关联 `VideoJob`、`WorkflowNode`、`Avatar`、输入音频 `Artifact`，并补充对应反向 relation。
- 本次完成：请求表记录 `mode`、`aspectRatio`、`crop`、`provider`、`providerRequestId`、`createdAt`、`updatedAt`，其中 `aspectRatio` 复用已有 `AspectRatio` 枚举。
- 明确未完成：本轮未实现 provider、输入校验 service、预览/高清 API、Worker、输出 artifact 写入、UI。

### TDD 记录
- RED：先新增 `tests/avatar-render-schema.test.ts`，执行 `npm run test:run -- tests/avatar-render-schema.test.ts`，4 tests failed，失败点为 `avatar_render_requests` 表、列、索引、外键均不存在。
- GREEN：补充 Prisma schema 与 migration，执行 `npx prisma migrate deploy`、`npx prisma generate` 后重新运行同一测试，1 file / 4 tests passed。

### 硬编码检查
- 是否新增运行时硬编码：否，本轮只新增数据库枚举、表结构和 schema 测试。
- 新增枚举是否收口：是，`mode` 收口到 `AvatarRenderMode`，`crop` 收口到 `AvatarRenderCrop`，`aspectRatio` 复用已有 `AspectRatio`。
- 新增配置是否收口：本轮未新增渲染分辨率、provider timeout、ffprobe 阈值等运行时配置；这些仍应在后续 Task 2/3/6 收口到 `src/lib/avatar-render/*`。

### 公共化检查
- 复用的公共模型：`VideoJob`、`WorkflowNode`、`Avatar`、`Artifact`、`AspectRatio`。
- 新增的公共模型：`AvatarRenderRequest`。
- 关系设计边界：`nodeId` 只建普通索引，不设唯一约束，保留同一 workflow node 后续多次 preview/hd request 或重试版本的扩展空间。
- artifact 边界：本轮只关联输入音频 artifact；输出视频 artifact 仍按 Task 5 复用 `writeWorkflowArtifact()` / `uploadJobArtifact()` 写入，不提前散写输出字段。

### 验证命令
- `npm run test:run -- tests/avatar-render-schema.test.ts`: RED 阶段失败，确认缺失表结构；GREEN 阶段通过，1 file / 4 tests。
- `npx prisma format --schema prisma/schema.prisma`: 通过。
- `npx prisma validate --schema prisma/schema.prisma`: 通过。
- `npx prisma migrate deploy`: 通过，应用 `20260623145600_add_avatar_render_requests`。
- `npx prisma generate`: 通过。
- `npm run test:run -- tests/avatar-render-schema.test.ts tests/workflow-constants.test.ts tests/local-model-service.test.ts tests/local-model-config.test.ts tests/workflow-worker-artifact-service.test.ts tests/avatar-api.test.ts tests/tts-result-service.test.ts`: 通过，7 files / 48 tests。
- `npx prisma migrate status`: 通过，Database schema is up to date。
- `npm run lint`: 通过。
- `npm run build`: 通过。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 1。
- 是否满足对应 Acceptance Criteria：满足 US-1 所需的渲染请求持久化基础，满足 US-4 所需的 mode、crop、aspectRatio 数据库约束基础。
- 是否允许勾选：允许勾选 Task 1，不允许勾选 Task 2-12。
- MVP 状态矩阵是否需要同步更新：需要，`voflow-video-render` 仍为 `partial`，下一步为 Task 2 定义 Avatar Render Provider 接口。

### Task 2: Avatar Render Provider 接口

### 任务
- Spec: `voflow-video-render`
- Task: 2
- Requirements: US-2、US-3

### 修改文件
- `src/lib/avatar-render/constants.ts`
- `src/lib/avatar-render/types.ts`
- `src/services/avatarRenderProviderService.ts`
- `tests/avatar-render-provider-service.test.ts`
- `.kiro/specs/voflow-video-render/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`

### 范围说明
- 本次完成：新增 avatar render 共享常量，收口 `preview`/`hd`、`head`/`half_body`、默认分辨率、mock/local provider 名称、local render path、timeout、错误码和错误文案。
- 本次完成：新增 `AvatarRenderPayload`、`AvatarRenderResult`、`AvatarRenderOptions`、`LocalAvatarRenderServiceConfig` 类型，作为 API/service/worker 后续共用的 provider 契约。
- 本次完成：新增 `AvatarRenderProvider` 接口，方法为 `renderAvatarVideo(payload)`，输出 `videoPath`、`durationMs`、`resolution`、`model`、`providerRequestId` 和 metadata。
- 本次完成：实现 `createMockAvatarRenderProvider()`，写入内嵌最小 MP4 fixture，生成可播放测试视频文件，并返回 deterministic metadata。
- 本次完成：实现 `createLocalAvatarRenderProvider(service, transport)`，只消费注入的 `LocalAvatarRenderServiceConfig` 和业务 payload，向 `${service.baseUrl}/avatar-render/render` 发起请求，不读取 `AVATAR_BASE_URL` 或 `process.env`。
- 明确未完成：本轮未接入 `local_model_services` 查询、未创建 render request service、未实现预览 API、未实现 Worker 上传 artifact、未实现 ffprobe 输出校验。
- mock/provider 边界：mock provider 只用于本地测试和后续流程打通，不代表真实 MuseTalk/SadTalker 口型渲染能力；真实 avatar provider 接入仍由 Task 9 验收。

### TDD 记录
- RED：先新增 `tests/avatar-render-provider-service.test.ts`，执行 `npm run test:run -- tests/avatar-render-provider-service.test.ts`，失败点为缺少 `@/lib/avatar-render/constants` 和 provider service 模块。
- GREEN：补充 `src/lib/avatar-render/*` 与 `src/services/avatarRenderProviderService.ts` 后重新运行同一测试，1 file / 4 tests passed。

### 硬编码检查
- 是否新增运行时硬编码：新增的 mode、crop、resolution、provider path、timeout、错误码均集中在 `src/lib/avatar-render/constants.ts`，未散写在 route/worker 中。
- 是否直接读取 `AVATAR_BASE_URL`：否。`rg -n "AVATAR_BASE_URL|process\\.env|LOCAL_MODEL_SERVICE_DEFINITIONS|baseUrlEnv" src/lib/avatar-render src/services/avatarRenderProviderService.ts tests/avatar-render-provider-service.test.ts` 无匹配。
- provider 地址边界：local provider 只消费调用方注入的 `service.baseUrl`；后续 Task 9 从 `local_model_services.avatar` 读取并传入。

### 公共化检查
- 新增公共模块：`src/lib/avatar-render/constants.ts`、`src/lib/avatar-render/types.ts`。
- 新增公共 service：`src/services/avatarRenderProviderService.ts`。
- 复用方式：接口风格对齐现有 `ttsProviderService` 和 `voiceTrainerService`，后续 Worker 可通过 `createAvatarRenderProvider(provider, localService)` 注入 mock/local provider。
- 测试边界：mock provider 使用内嵌 MP4 buffer，不依赖本机 ffmpeg、MinIO 或真实 avatar 服务；local provider 测试使用注入 transport，不访问公网或本地端口。

### 验证命令
- `npm run test:run -- tests/avatar-render-provider-service.test.ts`: RED 阶段失败，确认 provider 模块缺失；GREEN 阶段通过，1 file / 4 tests。
- `rg -n "AVATAR_BASE_URL|process\\.env|LOCAL_MODEL_SERVICE_DEFINITIONS|baseUrlEnv" src/lib/avatar-render src/services/avatarRenderProviderService.ts tests/avatar-render-provider-service.test.ts`: 无匹配，确认 render provider 未直接读取 env/service definition。
- `npm run test:run -- tests/avatar-render-provider-service.test.ts tests/avatar-render-schema.test.ts tests/workflow-constants.test.ts tests/local-model-service.test.ts tests/local-model-config.test.ts tests/workflow-worker-artifact-service.test.ts tests/avatar-api.test.ts tests/tts-provider-service.test.ts tests/tts-result-service.test.ts tests/voice-trainer-service.test.ts`: 通过，10 files / 57 tests。
- `npx prisma validate --schema prisma/schema.prisma`: 通过。
- `npm run lint`: 通过。
- `npm run build`: 通过。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 2。
- 是否满足对应 Acceptance Criteria：满足 US-2 的 preview/hd provider 抽象和 mock 视频输出基础，满足 US-3 的 provider 失败错误边界基础。
- 是否允许勾选：允许勾选 Task 2，不允许勾选 Task 3-12。
- MVP 状态矩阵是否需要同步更新：需要，`voflow-video-render` 仍为 `partial`，下一步为 Task 3 实现渲染输入校验服务。

### Task 3: 渲染输入校验服务

### 任务
- Spec: `voflow-video-render`
- Task: 3
- Requirements: US-1、US-4

### 修改文件
- `src/lib/avatar-render/constants.ts`
- `src/services/avatarRenderService.ts`
- `tests/avatar-render-service.test.ts`
- `.kiro/specs/voflow-video-render/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`

### 范围说明
- 本次完成：新增 `validateAvatarRenderInput(input)` service，输入为 `jobId`、`teamId`、`avatarId`、`audioArtifactId`、`aspectRatio`。
- 本次完成：校验 video job 存在且归属当前 team，且未取消。
- 本次完成：校验请求 `aspectRatio` 与项目 `project.aspectRatio` 一致，内部复用 `toPrismaAspectRatio()` / `toApiAspectRatio()` 做 API/Prisma 枚举转换。
- 本次完成：校验 avatar 属于当前 team、未删除、`status=ready`。
- 本次完成：校验 avatar `licenseStatus=approved`。
- 本次完成：校验 TTS 音频 artifact 来自同一 job、`type=audio`，且存在一条 `status=succeeded` 的 `ttsRequest` 关联该 `audioArtifactId`。
- 本次完成：成功时返回后续 Task 4/5 可复用的归一化 job、avatar source image URL、audio artifact 数据。
- 明确未完成：本轮未创建 preview render request、未创建 `avatar_render` workflow node、未投递队列、未写入 `avatar_render_requests`、未调用 provider。

### TDD 记录
- RED：先新增 `tests/avatar-render-service.test.ts`，执行 `npm run test:run -- tests/avatar-render-service.test.ts`，失败点为缺少 `@/services/avatarRenderService`。
- GREEN：补充 `src/services/avatarRenderService.ts` 并扩展 `src/lib/avatar-render/constants.ts` 错误码后重新运行同一测试，1 file / 5 tests passed。

### 硬编码检查
- 是否新增运行时硬编码：新增错误码和文案均收口在 `src/lib/avatar-render/constants.ts`。
- 错误码收口：新增并复用 `AVATAR_RENDER_JOB_NOT_FOUND`、`AVATAR_NOT_READY`、`AVATAR_LICENSE_NOT_APPROVED`、`TTS_AUDIO_NOT_FOUND`、`AVATAR_RENDER_ASPECT_RATIO_MISMATCH`。
- route/worker 是否散写错误码：否，本轮未新增 route/worker，service 通过 `AVATAR_RENDER_ERROR_CODES` 和 `AVATAR_RENDER_ERROR_MESSAGES` 返回错误。

### 公共化检查
- 新增公共 service：`src/services/avatarRenderService.ts`。
- 复用的公共模块：`src/lib/aspect-ratio.ts`、`src/lib/avatar-render/constants.ts`、`src/lib/db.ts`。
- 边界说明：输入校验集中在 service 层，后续 Task 4 的 API 应只负责鉴权、Zod/JSON 解析和调用该 service，不重复查询 avatar/audio/project。
- TTS 音频边界：要求 artifact 与 succeeded TTS request 关联，避免任意 audio artifact 被当作已生成 TTS 音频使用。

### 验证命令
- `npm run test:run -- tests/avatar-render-service.test.ts`: RED 阶段失败，确认 service 模块缺失；GREEN 阶段通过，1 file / 5 tests。
- `npm run test:run -- tests/avatar-render-service.test.ts tests/avatar-render-provider-service.test.ts tests/avatar-render-schema.test.ts tests/workflow-constants.test.ts tests/local-model-service.test.ts tests/local-model-config.test.ts tests/workflow-worker-artifact-service.test.ts tests/avatar-api.test.ts tests/tts-provider-service.test.ts tests/tts-result-service.test.ts tests/tts-service.test.ts`: 通过，11 files / 65 tests。
- `npx prisma validate --schema prisma/schema.prisma`: 通过。
- `rg -n "AVATAR_NOT_READY|AVATAR_LICENSE_NOT_APPROVED|TTS_AUDIO_NOT_FOUND|AVATAR_RENDER_ASPECT_RATIO_MISMATCH|AVATAR_RENDER_JOB_NOT_FOUND" src/lib/avatar-render src/services/avatarRenderService.ts tests/avatar-render-service.test.ts`: 通过，确认 Task 3 错误码集中在 avatar-render constants/service/test。
- `npm run lint`: 通过。
- `npm run build`: 通过。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 3。
- 是否满足对应 Acceptance Criteria：满足 US-1 的 ready avatar、approved license、TTS audio artifact 存在校验基础；满足 US-4 的 aspectRatio 与项目一致校验基础。
- 是否允许勾选：允许勾选 Task 3，不允许勾选 Task 4-12。
- MVP 状态矩阵是否需要同步更新：需要，`voflow-video-render` 仍为 `partial`，下一步为 Task 4 实现预览渲染 API。

### Task 4: 预览渲染 API

### 任务
- Spec: `voflow-video-render`
- Task: 4
- Requirements: US-2、US-4

### 修改文件
- `src/lib/aspect-ratio.ts`
- `src/lib/avatar-render/constants.ts`
- `src/services/avatarRenderService.ts`
- `src/app/api/video-jobs/[jobId]/avatar-render/preview/route.ts`
- `tests/avatar-render-service.test.ts`
- `tests/avatar-render-api.test.ts`
- `.kiro/specs/voflow-video-render/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`

### 范围说明
- 本次完成：新增 `POST /api/video-jobs/{jobId}/avatar-render/preview`，route 只负责鉴权、JSON/Zod 校验和调用 service。
- 本次完成：新增 `createPreviewAvatarRenderTask()`，复用 `validateAvatarRenderInput()` 校验 job、avatar、license、TTS audio artifact 和 aspectRatio。
- 本次完成：创建 `mode=preview` 的 `avatar_render_requests` 记录，关联 job、workflow node、avatar 和输入音频 artifact。
- 本次完成：创建并投递 `avatar_render` workflow node，node input 写入 `avatarRenderRequestId`、avatar/audio 信息、`mode=preview`、`aspectRatio` 和 `renderOptions`。
- 本次完成：`renderOptions.resolution` 固定复用 `AVATAR_RENDER_DEFAULT_RESOLUTIONS.preview`，route 中未散写 `"720p"`。
- 本次完成：预览任务创建后更新 video job 为 `queued`，`currentNode=avatar_render`，并按 workflow queue payload 投递 `jobId`、`nodeId`、`nodeType`、`version`、`traceId`。
- 本次完成：`VALID_ASPECT_RATIOS` 调整为 readonly tuple，便于 API route 和 service 共同复用 `z.enum()` 约束。
- 明确未完成：本轮未调用 provider、未下载 source image/audio、未上传 avatar video artifact、未写入输出 artifact、未执行 ffprobe 输出校验，也未实现 preview approval/hd 流程。
- mock/provider 边界：本轮只创建预览渲染任务并投递 workflow node；真正渲染仍待 Task 5 Worker 触发 provider。

### TDD 记录
- RED：先新增/扩展 `tests/avatar-render-service.test.ts` 和 `tests/avatar-render-api.test.ts`，执行 `npm run test:run -- tests/avatar-render-service.test.ts tests/avatar-render-api.test.ts`，失败点为 preview API route 缺失、`createPreviewAvatarRenderTask` 未实现。
- GREEN：补充 service 与 route 后重新运行同一测试，2 files / 9 tests passed。

### 硬编码检查
- 是否新增运行时硬编码：新增任务创建失败错误码和文案收口在 `src/lib/avatar-render/constants.ts`。
- preview resolution 是否散写：否，`renderOptions.resolution` 只从 `AVATAR_RENDER_DEFAULT_RESOLUTIONS.preview` 读取。
- route 是否散写 `"720p"`：否，`rg` 检查确认 preview route 内没有 `"720p"`。
- route 是否重复业务校验：否，route 不重复查询 avatar、audio artifact 或 project，统一委托 `createPreviewAvatarRenderTask()` / `validateAvatarRenderInput()`。

### 公共化检查
- 新增公共 service 方法：`createPreviewAvatarRenderTask()`。
- 复用的公共模块：`src/lib/avatar-render/constants.ts`、`src/lib/aspect-ratio.ts`、`src/lib/workflow/constants.ts`、`src/lib/workflow/trace.ts`、`src/lib/workflow/status.ts`、统一 API response、`requireAuth`、workflow queue。
- 边界说明：预览任务创建逻辑集中在 service 层，后续高清 API 可复用同类 request/node/queue 创建结构，但需增加 preview approval 前置校验。
- 事务边界：创建 workflow node、avatar render request、更新 node input 和 video job status 在同一 Prisma transaction 内完成；队列投递在 transaction 成功后执行。

### 验证命令
- `npm run test:run -- tests/avatar-render-service.test.ts tests/avatar-render-api.test.ts`: RED 阶段失败，确认 preview route/service 缺失；GREEN 阶段通过，2 files / 9 tests。
- `npm run test:run -- tests/avatar-render-api.test.ts tests/avatar-render-service.test.ts tests/avatar-render-provider-service.test.ts tests/avatar-render-schema.test.ts tests/workflow-constants.test.ts tests/local-model-service.test.ts tests/local-model-config.test.ts tests/workflow-worker-artifact-service.test.ts tests/avatar-api.test.ts tests/tts-provider-service.test.ts tests/tts-result-service.test.ts tests/tts-service.test.ts`: 通过，12 files / 69 tests。
- `npx prisma validate --schema prisma/schema.prisma`: 通过。
- `rg -n '720p|AVATAR_RENDER_DEFAULT_RESOLUTIONS|avatar_render|avatarRenderRequest|renderOptions' 'src/app/api/video-jobs/[jobId]/avatar-render/preview/route.ts' src/services/avatarRenderService.ts src/lib/avatar-render tests/avatar-render-api.test.ts tests/avatar-render-service.test.ts`: 通过，确认 route 未散写 `"720p"`，preview resolution 复用 avatar-render constants。
- `npm run lint`: 通过。
- `npm run build`: 通过，构建产物包含 `/api/video-jobs/[jobId]/avatar-render/preview`。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 4。
- 是否满足对应 Acceptance Criteria：满足 US-2 的低清 preview render request 和 `avatar_render` 节点投递基础；满足 US-4 的统一鉴权、输入校验、错误响应和项目比例校验复用基础。
- 是否允许勾选：允许勾选 Task 4，不允许勾选 Task 5-12。
- MVP 状态矩阵是否需要同步更新：需要，`voflow-video-render` 仍为 `partial`，下一步为 Task 5 实现 Avatar Render Worker。

### Task 5: Avatar Render Worker

### 任务
- Spec: `voflow-video-render`
- Task: 5
- Requirements: US-2、US-3

### 修改文件
- `src/lib/avatar-render/constants.ts`
- `src/lib/avatar-render/types.ts`
- `src/services/avatarRenderProviderService.ts`
- `src/services/avatarRenderWorkerService.ts`
- `src/services/workflowWorkerService.ts`
- `tests/avatar-render-worker-service.test.ts`
- `.kiro/specs/voflow-video-render/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`

### 范围说明
- 本次完成：新增 `createAvatarRenderWorkflowNodeHandler()`，并在 `createDefaultWorkflowNodeHandlers()` 注册 `avatar_render` handler。
- 本次完成：Worker 解析并校验 `avatar_render` node input，重新查询 `avatar_render_requests`，确保 request 与 `jobId`、`nodeId`、`avatarId`、`audioArtifactId` 一致。
- 本次完成：Worker 通过 storage dependency 下载 `sourceImageUrl` 和 `audioUrl`，默认实现复用 `getObjectByPath()` + `readableToBuffer()`，测试可注入 mock storage，避免依赖 MinIO。
- 本次完成：Worker 调用 `AvatarRenderProvider.renderAvatarVideo(payload)`，payload 带入 request/job/node/avatar、source/audio URL、下载后的 Buffer、mode、aspectRatio、renderOptions 和 traceId。
- 本次完成：非 mock provider 时从 `local_model_services` 读取 `serviceType=avatar` 的 `baseUrl`、`status`、`modelName` 后注入 provider；Worker 和 provider 均不直接读取 `AVATAR_BASE_URL`。
- 本次完成：local provider HTTP payload 显式剥离 `sourceImage` / `audio` Buffer，只发送可序列化业务字段，避免把二进制对象散入 JSON。
- 本次完成：读取 provider 输出视频文件，复用 `uploadJobArtifact(teamId, jobId, "avatar_render", ...)` 上传对象存储，复用 `writeWorkflowArtifact()` 写入 `type=avatar_video` artifact。
- 本次完成：成功后回写 `avatar_render_requests.provider` 和 `providerRequestId`，workflow output 返回 `avatarRenderRequestId`、`videoArtifactId`、`storageUrl`、`provider`、`providerRequestId` 和渲染 metadata。
- 本次完成：preview mode 成功时 handler 返回 `waiting_approval` 和 `requiresApproval=true`；后续 Task 7 仍需实现用户确认后创建 hd request、重试 preview 和完整确认 API/UI 流程。
- 明确未完成：本轮未实现 ffprobe 输出校验、invalid output 判定、高清渲染 API、真实 MuseTalk/SadTalker 人工联调、预览确认/重试 UI。
- mock/provider 边界：mock provider 仍用于自动化测试和本地流程打通，不代表真实口型渲染质量；真实 provider 接入与环境复验仍在 Task 9/Checkpoint。

### TDD 记录
- RED：先新增 `tests/avatar-render-worker-service.test.ts`，执行 `npm run test:run -- tests/avatar-render-worker-service.test.ts`，失败点为缺少 `@/services/avatarRenderWorkerService`。
- GREEN：补充 worker service、常量、payload 类型和默认 handler 注册后重新运行同一测试，1 file / 3 tests passed。
- 构建返修：`npm run build` 首次失败于 `src/services/avatarRenderWorkerService.ts` 中 `aspectRatio` 的 TypeScript 窄化，改为 `isApiAspectRatio()` type guard 后，focused test 和 build 均通过。

### 硬编码检查
- 是否新增运行时硬编码：新增 `avatar_video` artifact type、Worker 输入错误、request 缺失和 storage 错误码均收口在 `src/lib/avatar-render/constants.ts`。
- 是否散写 provider 地址：否，Worker 只读取 `local_model_services.avatar` 后注入 provider；provider 不读取 `AVATAR_BASE_URL` 或 `process.env`。
- 是否散写 artifact 路径：否，上传路径只通过 `uploadJobArtifact()` / `buildJobArtifactPath()` 间接生成，Worker 未拼接对象存储路径。
- 是否散写分辨率：否，Worker 消费 node input 中来自 Task 4 的 `renderOptions.resolution`；preview 默认值仍由 `AVATAR_RENDER_DEFAULT_RESOLUTIONS.preview` 生成。
- 是否散写 `avatar_video`：否，artifact type 使用 `AVATAR_RENDER_VIDEO_ARTIFACT_TYPE` 常量。

### 公共化检查
- 新增公共 service：`src/services/avatarRenderWorkerService.ts`。
- 复用的公共模块：`src/lib/avatar-render/constants.ts`、`src/lib/avatar-render/types.ts`、`src/lib/aspect-ratio.ts`、`src/lib/storage.ts`、`src/services/workflowArtifactService.ts`、`src/services/avatarRenderProviderService.ts`、`src/lib/workflow/status.ts`。
- provider 边界：`createAvatarRenderProvider(provider, localService)` 仍是 provider 创建入口；Worker 只负责读取 local model registry 并注入归一化 config。
- storage 边界：下载输入和读取 provider 输出文件均可注入，测试不访问 MinIO 或真实文件系统；默认运行路径复用对象存储 helper 和 Node fs。
- workflow 边界：handler 抛出的 `AvatarRenderProviderError` 带统一错误码，`executeWorkflowNode()` 可按现有逻辑把错误写入 node error。

### 验证命令
- `npm run test:run -- tests/avatar-render-worker-service.test.ts`: RED 阶段失败，确认 worker 模块缺失；GREEN 阶段通过，1 file / 3 tests。
- `npm run test:run -- tests/avatar-render-worker-service.test.ts tests/avatar-render-provider-service.test.ts`: 通过，2 files / 7 tests。
- `npm run test:run -- tests/avatar-render-worker-service.test.ts tests/avatar-render-api.test.ts tests/avatar-render-service.test.ts tests/avatar-render-provider-service.test.ts tests/avatar-render-schema.test.ts tests/workflow-worker-artifact-service.test.ts tests/workflow-constants.test.ts tests/local-model-service.test.ts tests/local-model-config.test.ts tests/tts-worker-service.test.ts tests/tts-provider-service.test.ts tests/tts-result-service.test.ts tests/tts-service.test.ts`: 通过，13 files / 62 tests。
- `npx prisma validate --schema prisma/schema.prisma`: 通过。
- `rg -n "AVATAR_BASE_URL|process\\.env|baseUrlEnv|720p|1080p|avatar_video|buildJobArtifactPath|uploadJobArtifact|AVATAR_RENDER_VIDEO_ARTIFACT_TYPE|AVATAR_RENDER_DEFAULT_RESOLUTIONS|AVATAR_RENDER_ERROR_CODES" src/services/avatarRenderWorkerService.ts src/services/avatarRenderProviderService.ts src/services/workflowWorkerService.ts src/lib/avatar-render tests/avatar-render-worker-service.test.ts`: 通过，确认 provider 地址未直接读取 env，分辨率、artifact type、错误码均集中在 avatar-render 常量，Worker 只复用 `uploadJobArtifact()`。
- `npm run lint`: 通过。
- `npm run build`: 首次失败于 `aspectRatio` 类型窄化；修复后通过。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 5。
- 是否满足对应 Acceptance Criteria：满足 US-2 的 preview worker 生成并保存 `avatar_video` artifact 基础，满足 US-3 的 provider 失败错误码透传和 workflow 失败标记基础。
- 是否允许勾选：允许勾选 Task 5，不允许勾选 Task 6-12。
- MVP 状态矩阵是否需要同步更新：需要，`voflow-video-render` 仍为 `partial`，下一步为 Task 6 实现输出视频校验。

### Task 6: 输出视频校验

### 任务
- Spec: `voflow-video-render`
- Task: 6
- Requirements: US-2、US-3

### 修改文件
- `src/lib/avatar-render/constants.ts`
- `src/lib/avatar-render/output-validation.ts`
- `src/services/avatarRenderWorkerService.ts`
- `tests/avatar-render-output-validation.test.ts`
- `tests/avatar-render-worker-service.test.ts`
- `.kiro/specs/voflow-video-render/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`

### 范围说明
- 本次完成：新增 `validateAvatarRenderOutput()`，在上传 artifact 前校验 provider 输出文件。
- 本次完成：校验输出文件存在且 `stat.size >= AVATAR_RENDER_MIN_OUTPUT_BYTES`，阈值集中在 `src/lib/avatar-render/constants.ts`。
- 本次完成：新增 `createFfprobeVideoProbe()`，通过 `execFile` 结构化 args 调用 ffprobe，解析 `format.duration` 和 video stream 信息。
- 本次完成：校验 ffprobe duration 为正数、video stream 数量大于 0；失败统一抛出 `AVATAR_RENDER_INVALID_OUTPUT`。
- 本次完成：输出校验成功后返回 `videoBuffer` 和 normalized metadata，包括 `sizeBytes`、`durationMs`、`expectedDurationMs`、`videoStreamCount`、`codecName`、`contentType`、`fileExtension`。
- 本次完成：Avatar Render Worker 从直接 `readFile()` 改为调用 `validateOutput()`，invalid output 会在上传和 `writeWorkflowArtifact()` 前阻断。
- 本次完成：Worker artifact metadata 合并 provider metadata 与 ffprobe 校验 metadata，写入 `avatar_video` artifact。
- 明确未完成：本轮未实现用户确认后创建 hd request、preview 重试、高清渲染 API、真实 provider 环境联调、UI 播放器或最终 checkpoint。
- ffprobe 边界：自动化测试通过注入 `probeVideo` / `commandRunner`，不依赖本机 ffprobe；真实运行默认使用 `FFPROBE_WORKER` 或 `ffprobe`。

### TDD 记录
- RED：先新增 `tests/avatar-render-output-validation.test.ts` 并扩展 `tests/avatar-render-worker-service.test.ts`，执行 `npm run test:run -- tests/avatar-render-output-validation.test.ts tests/avatar-render-worker-service.test.ts`，失败点为缺少 `@/lib/avatar-render/output-validation`。
- GREEN：补充输出校验 helper、常量和 Worker 集成后重新运行同一测试，2 files / 8 tests passed。

### 硬编码检查
- 是否新增运行时硬编码：新增输出最小大小阈值、ffprobe timeout、默认 ffprobe bin、invalid output 错误码均收口在 `src/lib/avatar-render/constants.ts`。
- 是否散写 artifact 路径：否，Worker 仍只通过 `uploadJobArtifact()` 上传，不拼接对象存储路径。
- 是否散写 `avatar_video`：否，仍使用 `AVATAR_RENDER_VIDEO_ARTIFACT_TYPE`。
- 是否散写 ffprobe 命令参数：ffprobe args 仅集中在 `src/lib/avatar-render/output-validation.ts` 的 `createFfprobeVideoProbe()`，未散入 Worker/API/UI。
- 是否散写错误码：否，invalid output 使用既有 `AVATAR_RENDER_ERROR_CODES.invalidProviderOutput` / `AVATAR_RENDER_INVALID_OUTPUT`。

### 公共化检查
- 新增公共 helper：`src/lib/avatar-render/output-validation.ts`。
- 复用的公共模块：`src/lib/avatar-render/constants.ts`、`src/services/avatarRenderWorkerService.ts`、`src/lib/storage.ts`、`src/services/workflowArtifactService.ts`。
- Worker 边界：Worker 只消费 `validateOutput()` 返回的 `videoBuffer` 和 metadata；ffprobe/stat/readFile 细节不散在 Worker 中。
- 测试边界：输出校验测试注入 `statFile`、`readFile`、`probeVideo`、`commandRunner`，不访问真实文件系统或本机 ffprobe。

### 验证命令
- `npm run test:run -- tests/avatar-render-output-validation.test.ts tests/avatar-render-worker-service.test.ts`: RED 阶段失败，确认 output-validation 模块缺失；GREEN 阶段通过，2 files / 8 tests。
- `npm run test:run -- tests/avatar-render-output-validation.test.ts tests/avatar-render-worker-service.test.ts tests/avatar-render-api.test.ts tests/avatar-render-service.test.ts tests/avatar-render-provider-service.test.ts tests/avatar-render-schema.test.ts tests/workflow-worker-artifact-service.test.ts tests/workflow-constants.test.ts tests/local-model-service.test.ts tests/local-model-config.test.ts tests/tts-worker-service.test.ts tests/tts-provider-service.test.ts tests/tts-result-service.test.ts tests/tts-service.test.ts`: 通过，14 files / 67 tests。
- `rg -n "ffprobe|FFPROBE|AVATAR_RENDER_MIN_OUTPUT_BYTES|AVATAR_RENDER_FFPROBE_TIMEOUT_MS|AVATAR_RENDER_INVALID_OUTPUT|avatar_video|uploadJobArtifact|buildJobArtifactPath|AVATAR_BASE_URL|process\\.env" src/lib/avatar-render src/services/avatarRenderWorkerService.ts src/services/avatarRenderProviderService.ts tests/avatar-render-output-validation.test.ts tests/avatar-render-worker-service.test.ts`: 通过，确认阈值、ffprobe timeout、默认命令、artifact type、错误码均集中在 avatar-render 模块，Worker 仍复用 `uploadJobArtifact()`。
- `npx prisma validate --schema prisma/schema.prisma`: 通过。
- `npm run lint`: 通过。
- `npm run build`: 通过。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 6。
- 是否满足对应 Acceptance Criteria：满足 US-2 的输出文件可用性校验基础；满足 US-3 的 invalid output 错误码返回和失败任务可由 workflow 标记失败的基础。
- 是否允许勾选：允许勾选 Task 6，不允许勾选 Task 7-12。
- MVP 状态矩阵是否需要同步更新：需要，`voflow-video-render` 仍为 `partial`，下一步为 Task 7 实现预览确认流程。

### Task 7: 预览确认流程

### 任务
- Spec: `voflow-video-render`
- Task: 7
- Requirements: US-2、US-3

### 修改文件
- `src/services/avatarRenderService.ts`
- `src/app/api/video-jobs/[jobId]/avatar-render/preview/[avatarRenderRequestId]/confirm/route.ts`
- `src/app/api/video-jobs/[jobId]/avatar-render/preview/[avatarRenderRequestId]/retry/route.ts`
- `tests/avatar-render-service.test.ts`
- `tests/avatar-render-api.test.ts`
- `.kiro/specs/voflow-video-render/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`

### 范围说明
- 本次完成：新增 `approveAvatarRenderPreview()`，只允许确认 `mode=preview` 且 workflow node 已处于 `waiting_approval` 的预览请求。
- 本次完成：用户确认预览后，将原 preview node 更新为 `approved`，写入 `approvedByUserId` 和 `approvedAt`。
- 本次完成：确认成功后创建新的 `mode=hd` `avatar_render_requests`，创建并投递新的 `avatar_render` workflow node，`renderOptions.resolution` 复用 `AVATAR_RENDER_DEFAULT_RESOLUTIONS.hd`。
- 本次完成：新增 `retryAvatarRenderPreview()`，只允许对 `waiting_approval` preview 发起重试，原 preview node 更新为 `cancelled`。
- 本次完成：重试预览时创建新的 `mode=preview` request/node，并复用 `AVATAR_RENDER_DEFAULT_RESOLUTIONS.preview` 重新投递队列。
- 本次完成：新增 `POST /api/video-jobs/{jobId}/avatar-render/preview/{avatarRenderRequestId}/confirm` 和 `/retry`，route 只负责鉴权、参数读取、service 调用和统一错误映射。
- 本次完成：`AVATAR_RENDER_PREVIEW_NOT_WAITING_APPROVAL` 统一作为非法确认/重试状态错误码，route 不散写状态文案。
- 明确未完成：本轮未实现独立高清渲染 API、真实 provider 环境联调、数字人渲染 UI、最终 checkpoint。
- mock/provider 边界：本轮只完成预览确认和重试编排；渲染执行仍沿用 Task 5 的 mock/local provider 抽象，真实模型能力仍待 Task 9/Checkpoint 复验。

### TDD 记录
- RED：先运行 `npm run test:run -- tests/avatar-render-api.test.ts tests/avatar-render-service.test.ts`，失败点为 confirm route 模块缺失、`approveAvatarRenderPreview` / `retryAvatarRenderPreview` 未实现。
- GREEN：补充 service 与 confirm/retry route 后重新运行同一测试，2 files / 13 tests passed。

### 硬编码检查
- 是否新增运行时硬编码：否，preview/hd 分辨率继续从 `AVATAR_RENDER_DEFAULT_RESOLUTIONS` 读取，非法状态错误码和文案继续收口在 `src/lib/avatar-render/constants.ts`。
- route 是否散写分辨率：否，confirm/retry route 不设置 `"720p"` 或 `"1080p"`。
- route 是否直接读取 provider/env：否，confirm/retry route 不读取 `AVATAR_BASE_URL`、`process.env` 或 local model 配置。
- 状态边界：service 内只处理 workflow node 状态推进和 request/node 创建；输出 artifact、provider、ffprobe 仍由 Worker 负责。

### 公共化检查
- 新增公共 service 方法：`approveAvatarRenderPreview()`、`retryAvatarRenderPreview()`。
- 新增 route：confirm/retry 预览动作 API。
- 复用的公共模块：`src/lib/avatar-render/constants.ts`、`src/lib/workflow/constants.ts`、`src/lib/workflow/trace.ts`、统一 API response、`requireAuth`、workflow queue。
- 事务边界：preview node 状态更新、hd/retry request 创建、workflow node 创建、video job 状态更新在同一 Prisma transaction 内完成；队列投递在 transaction 成功后执行。
- 复用关系：高清 request/node 创建复用与 preview 相同的归一化 node input 结构，避免后续 Worker 分支解析两套 payload。

### 验证命令
- `npm run test:run -- tests/avatar-render-api.test.ts tests/avatar-render-service.test.ts`: RED 阶段失败，确认 confirm/retry route 和 service 方法缺失；GREEN 阶段通过，2 files / 13 tests。
- `npm run test:run -- tests/avatar-render-api.test.ts tests/avatar-render-service.test.ts tests/avatar-render-worker-service.test.ts tests/avatar-render-output-validation.test.ts tests/avatar-render-provider-service.test.ts tests/avatar-render-schema.test.ts tests/workflow-worker-artifact-service.test.ts tests/workflow-constants.test.ts tests/local-model-service.test.ts tests/local-model-config.test.ts tests/tts-worker-service.test.ts tests/tts-provider-service.test.ts tests/tts-result-service.test.ts tests/tts-service.test.ts`: 通过，14 files / 71 tests。
- `rg -n '720p|1080p|AVATAR_RENDER_DEFAULT_RESOLUTIONS|waiting_approval|approved|cancelled|AVATAR_RENDER_PREVIEW_NOT_WAITING_APPROVAL|avatar_render|uploadJobArtifact|AVATAR_BASE_URL|process\\.env' src/services/avatarRenderService.ts 'src/app/api/video-jobs/[jobId]/avatar-render/preview/[avatarRenderRequestId]/confirm/route.ts' 'src/app/api/video-jobs/[jobId]/avatar-render/preview/[avatarRenderRequestId]/retry/route.ts' src/lib/avatar-render tests/avatar-render-api.test.ts tests/avatar-render-service.test.ts`: 通过，确认 route 未散写分辨率、provider 地址或 env 读取。
- `npx prisma validate --schema prisma/schema.prisma`: 通过。
- `npm run lint`: 通过。
- `npm run build`: 通过，构建产物包含 `/api/video-jobs/[jobId]/avatar-render/preview/[avatarRenderRequestId]/confirm` 和 `/retry`。

### 验收结论
- 是否满足当前 task：满足 Task 7。
- 是否满足对应 Acceptance Criteria：满足 US-2 的低清预览确认后进入高清渲染队列基础；满足 US-3 的预览不满意可重试且保留历史版本的基础。
- 是否允许勾选：允许勾选 Task 7，不允许勾选 Task 8-12。
- MVP 状态矩阵是否需要同步更新：需要，`voflow-video-render` 仍为 `partial`，下一步为 Task 8 实现高清渲染 API。
