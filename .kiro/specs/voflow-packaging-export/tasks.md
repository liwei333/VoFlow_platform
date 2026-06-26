# Tasks: voflow-packaging-export

## Implementation Plan

- [x] 0. 执行后续开发规范检查
  - 先阅读 `AI_RULES.md`
  - 本 Spec 不得在 Worker、API 或 UI 中散写 FFmpeg 参数、字幕样式、BGM 规则、封面尺寸、下载 URL 有效期、错误码或 artifact 路径
  - Export worker、ffprobe 校验、下载 URL、封面/字幕 serializer、端到端测试 fixture 和 API 响应必须进入公共 helper/service
  - 若发现同类逻辑已经重复两处以上，先抽公共函数或公共常量，再继续业务实现
  - Checkpoint 反馈必须包含硬编码检查、公共函数提取情况和验证命令
  - _Requirements: US-1, US-2, US-3, US-4, US-5_

- [x] 1. 创建导出请求数据库迁移
  - 创建 `export_requests`
  - 添加 output_profile、status 校验
  - 关联 job、node、avatar_video、audio、editing_config、subtitle、cover
  - _Requirements: US-4_

- [x] 2. 实现字幕生成服务
  - 根据确认文案生成 SRT
  - 支持按标点和长度分句
  - 保存 subtitle artifact
  - _Requirements: US-1_

- [x] 3. 实现 ASS 字幕样式模板
  - 定义字体、字号、颜色、描边、位置
  - 针对 9:16 默认不遮挡人脸
  - 输出 ASS 文件
  - _Requirements: US-1_

- [x] 4. 实现 BGM 选择和授权校验
  - 支持无 BGM 默认导出
  - 选择 BGM 时调用 asset 授权校验
  - 未授权 BGM 阻断导出
  - _Requirements: US-2_

- [x] 5. 实现人声优先混音
  - 使用 FFmpeg/pydub 实现 BGM 音量降低
  - 添加淡入淡出
  - 输出 mixed_audio artifact
  - _Requirements: US-2_

- [x] 6. 实现封面抽帧
  - 从 avatar_video 中间视频抽取清晰帧
  - MVP 可取中间帧或首个非黑帧
  - 保存 cover base image
  - _Requirements: US-3_

- [x] 7. 实现封面标题合成
  - 使用标题候选或确认标题
  - 将标题绘制到封面
  - 输出 cover artifact
  - _Requirements: US-3_

- [x] 8. 实现 Export Worker
  - 读取 avatar_video、audio、subtitle、optional BGM、editing_config
  - 应用画中画、背景、转场和音量参数
  - 调用 FFmpeg 合成最终 MP4
  - 上传 final_video artifact
  - _Requirements: US-1, US-2, US-4_

- [x] 9. 实现 ffprobe 媒体验收
  - 校验最终 MP4 文件非空
  - 校验包含 video stream
  - 校验包含 audio stream
  - 校验 duration 合理
  - _Requirements: US-4_

- [x] 10. 实现导出 API
  - 校验所需上游 artifact 存在
  - 创建 export_request
  - 投递 final_export 节点
  - _Requirements: US-4_

- [x] 11. 实现下载 API
  - 校验 artifact 属于当前 team
  - 生成短期下载 URL
  - 记录下载审计日志
  - _Requirements: US-4_

- [x] 12. 实现导出 UI
  - 展示字幕预览摘要
  - 支持选择 BGM 或无 BGM
  - 展示封面预览
  - 展示下载按钮
  - _Requirements: US-1, US-2, US-3, US-4_

- [x] 13. 实现端到端测试脚本
  - 使用 mock ASR/LLM/TTS/avatar provider
  - 从项目、文案、照片、音色跑到 final_video
  - 校验任务节点和 artifact 完整
  - _Requirements: US-5_

- [x] 14. 实现真实媒体冒烟测试
  - 使用一段短文案、测试头像、测试音频
  - 生成 9:16 MP4
  - 使用 ffprobe 校验音视频流
  - _Requirements: US-4, US-5_

- [x] 15. 添加失败重试测试
  - 模拟 FFmpeg 失败
  - 检查节点 failed 和错误码
  - 重试后生成新版本 artifact
  - _Requirements: US-4, US-5_

- [x] 16. Checkpoint: MVP 成片验收
  - 用户上传本人照片并创建数字人
  - 用户输入文案并生成 TTS
  - 系统生成数字人口播视频
  - 系统合成字幕、BGM、画中画、封面、最终 MP4
  - 用户可下载最终视频
  - _Requirements: US-1, US-2, US-3, US-4, US-5_

## 执行反馈

### Task 0: 后续开发规范检查与任务执行判断

### 任务
- Spec: `voflow-packaging-export`
- Task: 0
- Requirements: US-1、US-2、US-3、US-4、US-5

### 修改文件
- `.kiro/specs/voflow-packaging-export/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：读取并对照根目录 `AI_RULES.md`、`.kiro/plans/voflow-platform/plan.md`、`voflow-packaging-export` 的 `requirements.md`、`design.md`、`tasks.md`，确认 `voflow-advanced-editing` checkpoint 已完成，可以进入 packaging-export。
- 本次完成：确认 packaging-export 的实现边界是基于已确认文案、TTS audio artifact、`avatar_video` artifact 和 `editing_configs` 生成字幕/BGM/封面/final MP4，不重新触发数字人渲染。
- 本次完成：复核现有公共基础，确认 workflow 已有 `subtitle`、`bgm_mix`、`cover`、`final_export` node 类型，storage 可复用 `uploadJobArtifact()`，artifact 写入可复用 `writeWorkflowArtifact()`，下载可复用已有 storage 签名 URL 能力，FFmpeg/ffprobe 配置应复用 `local_model_services.ffmpeg` 和现有 avatar render output-validation 经验。
- 当前任务执行判断：Task 1 是下一个可执行任务，应先创建 `export_requests` 数据表和 Prisma model/migration，绑定 job、node、avatar_video artifact、audio artifact、editing_config、subtitle、cover、bgm asset，并收口 output profile/status。
- 明确未完成：本轮未创建数据库表、未实现字幕生成、ASS 模板、BGM 授权、混音、封面、Export Worker、ffprobe 验收、导出 API、下载 API、导出 UI 或端到端验收。
- 是否使用 mock/provider/adapter 占位：本轮未新增运行时代码；后续媒体生成任务如无法执行真实 FFmpeg，必须在任务反馈中标明 mock/fixture 边界，不能按真实 MP4 验收。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-10 的 schema/API/service/worker/UI/tests/Kiro 文档改动、`docs/05-开发进度说明.md` 同步、`src/components/editing/`、`src/lib/editing/`、`src/services/editing*`、`src/app/api/video-jobs/[jobId]/editing-*` 等。
- 本任务实际改动：仅更新 `voflow-packaging-export` Task 0 勾选和执行反馈，并同步总控 plan 和进度文档。
- 未触碰的既有改动：未修改 advanced-editing 的代码实现，未回滚前序 avatar render、TTS、voice clone 等改动。

### 硬编码检查
- 是否新增运行时硬编码：否，本轮只更新 Kiro 文档。
- 新增配置是否收口：本轮未新增配置；后续 FFmpeg 路径、ffprobe 参数、输出 profile、字幕样式、BGM ducking、封面尺寸、下载 URL 有效期必须收口到 `src/lib/export/*`、`src/lib/config.ts` 或等价领域模块。
- 新增错误码/状态/枚举是否收口：本轮未新增；后续 `SUBTITLE_GENERATION_FAILED`、`BGM_LICENSE_NOT_APPROVED`、`EXPORT_FFMPEG_FAILED`、`EXPORT_MEDIA_VALIDATION_FAILED`、output profile 和 export status 应统一收口。

### 公共化检查
- 复用的公共模块：`src/lib/workflow/constants.ts`、`src/lib/workflow/status.ts`、`src/services/workflowWorkerService.ts`、`src/lib/assets/consent.ts`、`src/lib/storage.ts`、`src/services/workflowArtifactService.ts`、`src/lib/editing/serializer.ts`、`src/services/avatarRenderResultService.ts`、`src/services/ttsResultService.ts`。
- 新增的公共函数/service：无。
- 后续需要抽取的重复逻辑：Task 1-4 应新增 `src/lib/export/constants.ts`、`src/lib/export/serializer.ts`、`src/services/exportRequestService.ts`、字幕/BGM 授权 helper；Task 8-9 应新增 FFmpeg/ffprobe 封装，不能在 Worker 中散写命令参数。

### 验证命令
- `rg -n "final_export|subtitle|bgm_mix|cover|final_video|download|avatar_video|editing_configs|editingConfig|uploadJobArtifact|writeWorkflowArtifact|ffprobe|ffmpeg" src prisma tests .kiro/specs/voflow-packaging-export .kiro/plans/voflow-platform/plan.md | head -n 240`: 通过，确认已有 workflow node、editing config、avatar_video、storage/artifact/ffprobe 相关基础。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 0。
- 是否满足对应 Acceptance Criteria：满足进入 packaging-export 前的规范检查、公共化边界确认和任务执行判断；US-1 到 US-5 的业务实现从 Task 1 开始。
- 是否允许勾选：允许勾选 Task 0，不允许勾选 Task 1-16。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行仍保持 `partial`；下一步开始最终成片导出的数据表和导出请求链路。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 0 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-packaging-export` Task 1。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 1: 创建导出请求数据库迁移

### 任务
- Spec: `voflow-packaging-export`
- Task: 1
- Requirements: US-4

### 修改文件
- `prisma/schema.prisma`
- `prisma/migrations/20260624145500_add_export_requests/migration.sql`
- `tests/export-request-schema.test.ts`
- `.kiro/specs/voflow-packaging-export/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `ExportOutputProfile` 枚举，允许 `mp4_720p`、`mp4_1080p`。
- 本次完成：新增 `ExportRequestStatus` 枚举，允许 `queued`、`running`、`succeeded`、`failed`。
- 本次完成：新增 `ExportRequest` Prisma model，并映射到 `export_requests` 表。
- 本次完成：`export_requests` 关联 `video_jobs`、`workflow_nodes`、`avatar_video` artifact、TTS audio artifact、`editing_configs`、可选 subtitle artifact、可选 BGM asset、可选 cover artifact。
- 本次完成：新增 job/node/status/outputProfile/BGM/cover 等查询索引，支撑后续导出 API、worker 状态查询和下载入口。
- 本次完成：新增 schema 级 RED-GREEN 测试覆盖表、枚举、列、外键和索引；执行前测试确认表不存在，执行后测试通过。
- 明确未完成：本轮未实现字幕生成、ASS 样式、BGM 授权/混音、封面抽帧/标题合成、Export Worker、ffprobe 验收、导出 API、下载 API、导出 UI 或最终 MP4 合成下载。
- 是否使用 mock/provider/adapter 占位：否，本轮只新增数据库 schema、migration 和 schema 测试。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-10 的 schema/API/service/worker/UI/tests/Kiro 文档改动，以及 `voflow-packaging-export` Task 0 文档改动。
- 本任务实际改动：新增 export request Prisma model、数据库 migration、schema 验收测试，并同步 Kiro 任务文档、总控 plan 和开发进度说明。
- 未触碰的既有改动：未修改 advanced-editing 的业务实现，未回滚前序 avatar render、TTS、voice clone 等改动。

### 硬编码检查
- 是否新增运行时硬编码：否，本轮没有新增 Worker、API route 或 UI 运行时代码。
- 新增状态/枚举是否收口：是，`ExportOutputProfile` 和 `ExportRequestStatus` 收口到 Prisma enum，并由 PostgreSQL enum 做数据库层校验。
- 新增路径/FFmpeg 参数/下载 URL 有效期：无，本轮未涉及媒体处理和下载。

### 公共化检查
- 复用的公共基础：现有 `video_jobs`、`workflow_nodes`、`artifacts`、`editing_configs`、`assets` 关系模型。
- 新增的公共函数/service：无，Task 1 仅建模。
- 后续需要抽取的公共模块：Task 2-4 开始应新增 `src/lib/export/*` 和 `src/services/export*`，用于集中字幕、BGM、封面、导出错误码、输出 profile 和 worker 参数。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-request-schema.test.ts`: 先失败，通过表不存在、列/外键/索引为空确认 RED。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma format`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma validate`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma migrate deploy`: 通过，已应用 `20260624145500_add_export_requests`。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma generate`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-request-schema.test.ts tests/editing-config-schema.test.ts`: 通过，2 个文件、9 个测试通过。

### 验收结论
- 是否满足当前 task：满足 Task 1。
- 是否满足对应 Acceptance Criteria：满足 US-4 的导出请求数据基础，output profile/status 由 enum 校验，job/node/avatar video/audio/editing config/subtitle/BGM/cover 关系已建立。
- 是否允许勾选：允许勾选 Task 1，不允许勾选 Task 2-16。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行仍为 `partial`；证据更新为 packaging-export 已完成导出请求表，缺口仍是字幕/BGM/封面/final MP4/下载。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 1 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-packaging-export` Task 2。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 2: 实现字幕生成服务

### 任务
- Spec: `voflow-packaging-export`
- Task: 2
- Requirements: US-1

### 修改文件
- `src/lib/export/constants.ts`
- `src/lib/export/subtitle.ts`
- `src/services/exportSubtitleService.ts`
- `tests/export-subtitle-service.test.ts`
- `.kiro/specs/voflow-packaging-export/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 export 领域常量，集中 subtitle artifact type、SRT 文件名、MIME、分句/时间估算参数和字幕错误码。
- 本次完成：新增 `splitSubtitleText()`，支持按句末标点切分，并在单条字幕超过最大长度时稳定拆分。
- 本次完成：新增 `buildSubtitleCues()` 和 `buildSrtSubtitle()`，根据确认文案生成确定性 SRT 内容。
- 本次完成：新增 `createSubtitleArtifactForJob()`，从当前 job 最新 `succeeded` 且有 audio artifact 的 TTS request 读取 approved script candidate 内容，生成 SRT，上传到 job artifact 路径，并写入 `subtitle` artifact。
- 本次完成：subtitle artifact metadata 记录 `format`、`sourceScriptCandidateId`、`audioArtifactId` 和 `segmentCount`，供后续 Export Worker 复用。
- 明确未完成：本轮未实现 ASS 样式、字幕硬烧录、BGM、封面、Export Worker、导出 API、下载 API 或最终 MP4 合成下载。
- 是否使用 mock/provider/adapter 占位：service 测试使用可注入 fake repository/uploader/artifact writer；运行时代码默认复用真实 Prisma、MinIO `uploadJobArtifact()` 和 `writeWorkflowArtifact()`。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-10 改动、`voflow-packaging-export` Task 0-1 改动和 Kiro 文档改动。
- 本任务实际改动：新增 export 字幕 helper/service/test，并同步 Kiro 任务文档、总控 plan 和开发进度说明。
- 未触碰的既有改动：未修改 advanced-editing 的业务实现，未回滚前序 avatar render、TTS、voice clone 等改动。

### 硬编码检查
- 是否新增运行时硬编码：未在 Worker/API/UI 中散写字幕参数；SRT 文件名、MIME、artifact type、分句和时间估算参数已集中到 `src/lib/export/constants.ts`。
- 新增错误码是否收口：是，`SUBTITLE_SOURCE_NOT_FOUND`、`SUBTITLE_GENERATION_FAILED` 收口到 export constants。
- 新增 FFmpeg 参数/下载 URL 有效期：无，本轮未涉及 FFmpeg 和下载。

### 公共化检查
- 新增公共 helper：`src/lib/export/subtitle.ts`。
- 新增公共 service：`src/services/exportSubtitleService.ts`。
- 复用的公共模块：`uploadJobArtifact()`、`writeWorkflowArtifact()`、Prisma TTS/script/artifact 关系。
- 后续复用点：Task 3 的 ASS 模板和 Task 8 的 Export Worker 应复用 export 领域常量，不在 Worker 中重写 subtitle 文件类型或错误码。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-subtitle-service.test.ts`: 先失败，确认 `src/lib/export/subtitle` 不存在；实现后通过，1 个文件、4 个测试通过。

### 验收结论
- 是否满足当前 task：满足 Task 2。
- 是否满足对应 Acceptance Criteria：满足 US-1 中“最终文案和音频存在时生成 SRT/ASS 字幕”和“字幕生成成功保存 subtitle artifact”的基础服务能力；字幕硬烧录到 MP4 将在 Task 8 final export 中完成。
- 是否允许勾选：允许勾选 Task 2，不允许勾选 Task 3-16。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行仍为 `partial`；证据更新为 packaging-export 已具备 SRT subtitle artifact 生成服务，缺口仍是 ASS 样式、BGM、封面、final MP4 和下载。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 2 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-packaging-export` Task 3。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 3: 实现 ASS 字幕样式模板

### 任务
- Spec: `voflow-packaging-export`
- Task: 3
- Requirements: US-1

### 修改文件
- `src/lib/export/constants.ts`
- `src/lib/export/subtitle.ts`
- `src/services/exportSubtitleService.ts`
- `tests/export-subtitle-service.test.ts`
- `.kiro/specs/voflow-packaging-export/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 9:16 ASS 脚本分辨率常量 `1080x1920`。
- 本次完成：新增 ASS 默认字幕样式常量，包含字体 `Noto Sans CJK SC`、字号 52、白色主色、黑色描边、半透明背景、居中底部对齐、左右安全边距 72、底部安全边距 300。
- 本次完成：新增 `buildAssSubtitle()`，输出 `[Script Info]`、`[V4+ Styles]`、`[Events]` 和 Dialogue 行，并复用 Task 2 的分句/时间轴。
- 本次完成：新增 `createAssSubtitleArtifactForJob()`，可将确认文案输出为 `subtitle.ass`，MIME 为 `text/x-ass`，并保存 `format: ass` 的 subtitle artifact。
- 明确未完成：本轮未实现字幕硬烧录到 MP4、BGM 授权/混音、封面、Export Worker、ffprobe 验收、导出 API、下载 API 或最终 MP4 合成下载。
- 是否使用 mock/provider/adapter 占位：service 测试使用可注入 fake repository/uploader/artifact writer；运行时代码默认复用真实 Prisma、MinIO `uploadJobArtifact()` 和 `writeWorkflowArtifact()`。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-10 改动、`voflow-packaging-export` Task 0-2 改动和 Kiro 文档改动。
- 本任务实际改动：扩展 export subtitle helper/service/test，新增 ASS 模板和 ASS artifact 输出能力，并同步 Kiro 任务文档、总控 plan 和开发进度说明。
- 未触碰的既有改动：未修改 advanced-editing 的业务实现，未回滚前序 avatar render、TTS、voice clone 等改动。

### 硬编码检查
- 是否新增运行时硬编码：未在 Worker/API/UI 中散写 ASS 参数；字体、字号、颜色、描边、位置、安全边距、ASS 文件名和 MIME 均收口到 `src/lib/export/constants.ts`。
- 新增错误码是否收口：无新增错误码，复用 Task 2 的 export subtitle 错误码。
- 新增 FFmpeg 参数/下载 URL 有效期：无，本轮未涉及 FFmpeg 和下载。

### 公共化检查
- 复用的公共 helper：`buildSubtitleCues()`、`splitSubtitleText()`。
- 新增公共 helper：`buildAssSubtitle()`、`formatAssTimestamp()`。
- 新增公共 service 入口：`createAssSubtitleArtifactForJob()`。
- 后续复用点：Task 8 的 Export Worker 应直接复用 ASS artifact 或 `createAssSubtitleArtifactForJob()`，不能在 Worker 中重写 ASS header/style/event 模板。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-subtitle-service.test.ts`: 先失败，确认 `buildAssSubtitle` 不存在；实现后通过，1 个文件、6 个测试通过。

### 验收结论
- 是否满足当前 task：满足 Task 3。
- 是否满足对应 Acceptance Criteria：满足 US-1 的字幕文件生成能力，SRT/ASS 均可生成 subtitle artifact；字幕硬烧录到 MP4 将在 Task 8 final export 中完成。
- 是否允许勾选：允许勾选 Task 3，不允许勾选 Task 4-16。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行仍为 `partial`；证据更新为 packaging-export 已具备 SRT/ASS subtitle artifact 生成服务，缺口仍是 BGM、封面、final MP4 和下载。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 3 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-packaging-export` Task 4。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 4: 实现 BGM 选择和授权校验

### 任务
- Spec: `voflow-packaging-export`
- Task: 4
- Requirements: US-2

### 修改文件
- `src/lib/export/constants.ts`
- `src/services/exportBgmService.ts`
- `tests/export-bgm-service.test.ts`
- `.kiro/specs/voflow-packaging-export/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `resolveExportBgmAsset()`，支持无 BGM 默认通过。
- 本次完成：选择 BGM 时按 team 读取 asset，禁止跨团队、已删除或不存在素材。
- 本次完成：BGM 素材类型仅允许 `audio` 或 `bgm`，非音频素材返回 `BGM_ASSET_TYPE_UNSUPPORTED`。
- 本次完成：BGM 授权校验复用 `assertAssetUsable(assetId, "video_generation")`，未授权或 usage scope 不匹配返回 `BGM_LICENSE_NOT_APPROVED`。
- 本次完成：新增 `EXPORT_BGM_USAGE_SCOPE`，为 Task 5 混音服务提供稳定输入边界。
- 明确未完成：本轮未实现 BGM 混音、淡入淡出、字幕硬烧录、封面、Export Worker、ffprobe 验收、导出 API、下载 API 或最终 MP4 合成下载。
- 是否使用 mock/provider/adapter 占位：service 测试使用 fake repository 和 fake `assertAssetUsable`；运行时代码默认复用真实 Prisma asset 查询和 `assertAssetUsable()`。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-10 改动、`voflow-packaging-export` Task 0-3 改动和 Kiro 文档改动。
- 本任务实际改动：新增 export BGM 授权 service/test，扩展 export 错误码，并同步 Kiro 任务文档、总控 plan 和开发进度说明。
- 未触碰的既有改动：未修改 advanced-editing 的业务实现，未回滚前序 avatar render、TTS、voice clone 等改动。

### 硬编码检查
- 是否新增运行时硬编码：未在 Worker/API/UI 中散写 BGM 授权规则；错误码和错误文案已收口到 `src/lib/export/constants.ts`。
- 授权 scope 是否收口：是，运行时代码通过 `EXPORT_BGM_USAGE_SCOPE = "video_generation"` 传给既有资产授权 helper。
- 新增 FFmpeg 参数/下载 URL 有效期：无，本轮未涉及 FFmpeg 和下载。

### 公共化检查
- 复用的公共模块：`assertAssetUsable()`、Prisma asset 查询。
- 新增公共 service：`src/services/exportBgmService.ts`。
- 后续复用点：Task 5 的混音服务和 Task 10 的导出 API 应复用 `resolveExportBgmAsset()`，不能重复写 BGM 授权判断。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-bgm-service.test.ts`: 先失败，确认 `exportBgmService` 不存在；实现后通过，1 个文件、4 个测试通过。

### 验收结论
- 是否满足当前 task：满足 Task 4。
- 是否满足对应 Acceptance Criteria：满足 US-2 中“用户选择 BGM 时校验授权状态”和“BGM 未授权拒绝合成”；“合成音频保持人声优先”将在 Task 5 完成。
- 是否允许勾选：允许勾选 Task 4，不允许勾选 Task 5-16。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行仍为 `partial`；证据更新为 packaging-export 已具备 BGM 选择授权校验，缺口仍是 BGM 混音、封面、final MP4 和下载。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 4 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-packaging-export` Task 5。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 5: 实现人声优先混音

### 任务
- Spec: `voflow-packaging-export`
- Task: 5
- Requirements: US-2

### 修改文件
- `src/lib/export/constants.ts`
- `src/lib/export/audio-mix.ts`
- `src/services/exportAudioMixService.ts`
- `tests/export-audio-mix-service.test.ts`
- `.kiro/specs/voflow-packaging-export/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `buildBgmMixFfmpegArgs()`，构建人声优先的 FFmpeg 参数。
- 本次完成：BGM 轨道应用音量降低、淡入、淡出和 `sidechaincompress` ducking，再与人声轨道 `amix`。
- 本次完成：新增 `createMixedAudioArtifact()`，执行 FFmpeg、读取 mixed audio、上传 `mixed_audio.wav`，并写入 `mixed_audio` artifact。
- 本次完成：默认 FFmpeg executor 从 `local_model_services.ffmpeg.baseUrl` 读取命令路径，且要求服务状态 `online`，不在 service 中写死 FFmpeg 路径。
- 明确未完成：本轮未实现封面、Export Worker、final MP4、ffprobe 验收、导出 API、下载 API、导出 UI 或端到端真实媒体冒烟。
- 是否使用 mock/provider/adapter 占位：service 测试使用 fake FFmpeg executor、fake 文件读取、fake uploader 和 fake artifact writer；运行时代码默认复用真实 Prisma FFmpeg 配置、MinIO `uploadJobArtifact()` 和 `writeWorkflowArtifact()`。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-10 改动、`voflow-packaging-export` Task 0-4 改动和 Kiro 文档改动。
- 本任务实际改动：新增 export audio mix helper/service/test，扩展 export 混音常量，并同步 Kiro 任务文档、总控 plan 和开发进度说明。
- 未触碰的既有改动：未修改 advanced-editing 的业务实现，未回滚前序 avatar render、TTS、voice clone 等改动。

### 硬编码检查
- 是否新增运行时硬编码：未在 Worker/API/UI 中散写混音参数；mixed audio 文件名、MIME、BGM 音量、fade 时长和 ducking 参数已收口到 `src/lib/export/constants.ts`。
- FFmpeg 路径是否硬编码：否，默认 executor 从 `local_model_services.ffmpeg.baseUrl` 读取。
- 新增下载 URL 有效期：无，本轮未涉及下载。

### 公共化检查
- 新增公共 helper：`src/lib/export/audio-mix.ts`。
- 新增公共 service：`src/services/exportAudioMixService.ts`。
- 复用的公共模块：`uploadJobArtifact()`、`writeWorkflowArtifact()`、`local_model_services.ffmpeg`。
- 后续复用点：Task 8 的 Export Worker 应复用 `createMixedAudioArtifact()` 或 `buildBgmMixFfmpegArgs()`，不能在 Worker 中重写混音参数。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-audio-mix-service.test.ts`: 先失败，确认 `src/lib/export/audio-mix` 不存在；实现后通过，1 个文件、3 个测试通过。

### 验收结论
- 是否满足当前 task：满足 Task 5。
- 是否满足对应 Acceptance Criteria：满足 US-2 中“合成音频保持人声优先”的服务和命令构建基础；真实 FFmpeg 媒体输出将在 Task 14 冒烟测试复验。
- 是否允许勾选：允许勾选 Task 5，不允许勾选 Task 6-16。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行仍为 `partial`；证据更新为 packaging-export 已具备 BGM 授权和人声优先 mixed_audio artifact 服务，缺口仍是封面、final MP4 和下载。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 5 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-packaging-export` Task 6。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 6: 实现封面抽帧

### 任务
- Spec: `voflow-packaging-export`
- Task: 6
- Requirements: US-3

### 修改文件
- `src/lib/export/constants.ts`
- `src/lib/export/cover.ts`
- `src/services/exportFfmpegService.ts`
- `src/services/exportAudioMixService.ts`
- `src/services/exportCoverService.ts`
- `tests/export-cover-service.test.ts`
- `.kiro/specs/voflow-packaging-export/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增公共 `executeConfiguredFfmpeg()`，从 `local_model_services.ffmpeg.baseUrl` 读取 FFmpeg 命令路径，并被 audio mix 和 cover service 复用。
- 本次完成：新增 `buildCoverFrameFfmpegArgs()`，默认按视频 duration 中点抽取 1 帧，缺少 duration 时 fallback 到 1 秒。
- 本次完成：新增 `createCoverBaseArtifact()`，执行 FFmpeg 抽帧、读取封面图、上传 `cover_base.jpg`，并写入 `cover` artifact。
- 本次完成：cover artifact metadata 记录 `avatarVideoArtifactId`、`frameTimeSeconds` 和 `stage: base_frame`，为 Task 7 标题合成提供基础图。
- 明确未完成：本轮未实现封面标题合成、Export Worker、final MP4、ffprobe 验收、导出 API、下载 API、导出 UI 或端到端真实媒体冒烟。
- 是否使用 mock/provider/adapter 占位：service 测试使用 fake FFmpeg executor、fake 文件读取、fake uploader 和 fake artifact writer；运行时代码默认复用真实 Prisma FFmpeg 配置、MinIO `uploadJobArtifact()` 和 `writeWorkflowArtifact()`。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-10 改动、`voflow-packaging-export` Task 0-5 改动和 Kiro 文档改动。
- 本任务实际改动：新增 export cover helper/service/test，抽取公共 FFmpeg executor，并同步 Kiro 任务文档、总控 plan 和开发进度说明。
- 未触碰的既有改动：未修改 advanced-editing 的业务实现，未回滚前序 avatar render、TTS、voice clone 等改动。

### 硬编码检查
- 是否新增运行时硬编码：未在 Worker/API/UI 中散写封面参数；cover 文件名、MIME、抽帧 fallback 时间和 JPEG 质量已收口到 `src/lib/export/constants.ts`。
- FFmpeg 路径是否硬编码：否，公共 executor 从 `local_model_services.ffmpeg.baseUrl` 读取。
- 新增下载 URL 有效期：无，本轮未涉及下载。

### 公共化检查
- 新增公共 helper：`src/lib/export/cover.ts`。
- 新增公共 service：`src/services/exportCoverService.ts`。
- 抽取公共 service：`src/services/exportFfmpegService.ts`，供 audio mix 和 cover 共用。
- 后续复用点：Task 7 标题合成和 Task 8 Export Worker 应复用 cover artifact metadata 和公共 FFmpeg executor，不能重复写 FFmpeg 配置读取逻辑。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-cover-service.test.ts`: 先失败，确认 `src/lib/export/cover` 不存在。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-cover-service.test.ts tests/export-audio-mix-service.test.ts`: 实现后通过，2 个文件、6 个测试通过。

### 验收结论
- 是否满足当前 task：满足 Task 6。
- 是否满足对应 Acceptance Criteria：满足 US-3 中“数字人视频存在时支持抽帧生成封面”和“封面生成成功保存 cover artifact”的基础抽帧能力；封面标题合成将在 Task 7 完成。
- 是否允许勾选：允许勾选 Task 6，不允许勾选 Task 7-16。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行仍为 `partial`；证据更新为 packaging-export 已具备 cover base image artifact 服务，缺口仍是封面标题、final MP4 和下载。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 6 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-packaging-export` Task 7。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 7: 实现封面标题合成

### 任务
- Spec: `voflow-packaging-export`
- Task: 7
- Requirements: US-3

### 修改文件
- `src/lib/export/constants.ts`
- `src/lib/export/cover.ts`
- `src/services/exportCoverService.ts`
- `tests/export-cover-service.test.ts`
- `.kiro/specs/voflow-packaging-export/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `resolveCoverTitleText()`，优先使用标题候选首项，缺失时从确认脚本文案截取封面标题。
- 本次完成：新增封面标题样式常量，集中标题最大长度、遮罩位置、遮罩高度、遮罩颜色、字体颜色、字号、行距和标题 Y 坐标。
- 本次完成：新增 `buildCoverTitleFfmpegArgs()`，使用 FFmpeg `drawbox` + `drawtext` 将标题绘制到 cover base image。
- 本次完成：新增 `createCoverTitleArtifact()`，复用 base cover image，输出 `cover_title.jpg` 并写入 `cover` artifact。
- 明确未完成：本轮未实现 Export Worker、final MP4、ffprobe 验收、导出 API、下载 API、导出 UI 或端到端真实媒体冒烟。
- 是否使用 mock/provider/adapter 占位：service 测试使用 fake FFmpeg executor、fake 文件读取、fake uploader 和 fake artifact writer；运行时代码默认复用真实公共 FFmpeg executor、MinIO `uploadJobArtifact()` 和 `writeWorkflowArtifact()`。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-10 改动、`voflow-packaging-export` Task 0-6 改动和 Kiro 文档改动。
- 本任务实际改动：扩展 export cover helper/service/test，新增封面标题合成能力，并同步 Kiro 任务文档、总控 plan 和开发进度说明。
- 未触碰的既有改动：未修改 advanced-editing 的业务实现，未回滚前序 avatar render、TTS、voice clone 等改动。

### 硬编码检查
- 是否新增运行时硬编码：未在 Worker/API/UI 中散写封面标题参数；标题最大长度、遮罩、字体和安全区参数已收口到 `src/lib/export/constants.ts`。
- FFmpeg 路径是否硬编码：否，继续复用公共 `executeConfiguredFfmpeg()`。
- 新增下载 URL 有效期：无，本轮未涉及下载。

### 公共化检查
- 复用公共 helper：`buildCoverFrameFfmpegArgs()` 和公共 FFmpeg executor。
- 新增公共 helper：`resolveCoverTitleText()`、`buildCoverTitleFfmpegArgs()`。
- 新增公共 service 入口：`createCoverTitleArtifact()`。
- 后续复用点：Task 8 Export Worker 应复用 cover base/title artifact 服务，不能重复写 drawbox/drawtext 参数。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-cover-service.test.ts`: 先失败，确认标题 helper/service 不存在；实现后通过，1 个文件、6 个测试通过。

### 验收结论
- 是否满足当前 task：满足 Task 7。
- 是否满足对应 Acceptance Criteria：满足 US-3 中“最终文案存在时生成封面标题文本”和“封面生成成功保存 cover artifact”；真实图像合成质量将在 Task 14 真实媒体冒烟复验。
- 是否允许勾选：允许勾选 Task 7，不允许勾选 Task 8-16。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行仍为 `partial`；证据更新为 packaging-export 已具备封面抽帧和标题合成服务，缺口仍是 final MP4、下载和端到端验收。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 7 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-packaging-export` Task 8。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 8: 实现 Export Worker

### 任务
- Spec: `voflow-packaging-export`
- Task: 8
- Requirements: US-1、US-2、US-4

### 修改文件
- `src/lib/export/constants.ts`
- `src/lib/export/final-video.ts`
- `src/services/exportWorkerService.ts`
- `src/services/workflowWorkerService.ts`
- `tests/export-worker-service.test.ts`
- `.kiro/specs/voflow-packaging-export/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 final MP4 输出常量，集中 `final_video.mp4`、`video/mp4` 和 `mp4_720p`/`mp4_1080p` 输出尺寸。
- 本次完成：新增 `buildFinalVideoFfmpegArgs()`，读取 avatar video、audio、可选 subtitle，并按 output profile 缩放、硬烧字幕、映射视频/音频流、输出 H.264/AAC MP4。
- 本次完成：新增 `createFinalExportWorkflowNodeHandler()`，读取 `exportRequestId`，加载 export request、avatar_video artifact、audio artifact、subtitle artifact、editing_config、BGM/cover 关联信息。
- 本次完成：Export Worker materialize 上游对象、执行 FFmpeg、读取输出 MP4、上传 `final_video` artifact，并将 export request 标记 `succeeded`。
- 本次完成：`final_export` 已注册到默认 workflow handlers。
- 降级说明：Task 8 的 FFmpeg 参数已接入字幕和 output profile；画中画、背景、转场、音量等 advanced editing 参数已随 `editingConfigId` 和 metadata 传递，具体复杂 filter 仍需在后续真实媒体联调中继续增强，不能按完整复杂剪辑引擎验收。
- 明确未完成：本轮未实现 ffprobe 媒体验收、导出 API、下载 API、导出 UI 或端到端真实媒体冒烟。
- 是否使用 mock/provider/adapter 占位：Worker 测试使用 fake materialize、fake FFmpeg executor、fake 文件读取、fake uploader 和 fake artifact writer；运行时代码默认复用真实对象存储下载、公共 FFmpeg executor、MinIO `uploadJobArtifact()` 和 `writeWorkflowArtifact()`。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-10 改动、`voflow-packaging-export` Task 0-7 改动和 Kiro 文档改动。
- 本任务实际改动：新增 final-video helper/export worker/test，注册 workflow handler，并同步 Kiro 任务文档、总控 plan 和开发进度说明。
- 未触碰的既有改动：未修改 advanced-editing 的业务实现，未回滚前序 avatar render、TTS、voice clone 等改动。

### 硬编码检查
- 是否新增运行时硬编码：未在 Worker 中散写输出文件名、MIME、profile 尺寸或错误码；已收口到 `src/lib/export/constants.ts` 和 `src/lib/export/final-video.ts`。
- FFmpeg 路径是否硬编码：否，继续复用公共 `executeConfiguredFfmpeg()`。
- 新增下载 URL 有效期：无，本轮未涉及下载。

### 公共化检查
- 新增公共 helper：`src/lib/export/final-video.ts`。
- 新增公共 service：`src/services/exportWorkerService.ts`。
- 复用公共 service：`src/services/exportFfmpegService.ts`、`writeWorkflowArtifact()`、`uploadJobArtifact()`。
- 后续复用点：Task 10 导出 API 应创建 export request 和 final_export node，Task 9 应在 Worker 上传/成功前接入 ffprobe validation。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-worker-service.test.ts`: 先失败，确认 `src/lib/export/final-video` 不存在；实现后通过，1 个文件、3 个测试通过。

### 验收结论
- 是否满足当前 task：满足 Task 8 的 Worker 骨架和 final_video artifact 输出；复杂画中画/背景/转场 filter 仍是后续增强缺口，已在降级说明中记录，不能按完整复杂剪辑生产能力验收。
- 是否满足对应 Acceptance Criteria：满足 US-1/US-2/US-4 的最终 MP4 合成基础路径；输出媒体质量验证将在 Task 9 完成。
- 是否允许勾选：允许勾选 Task 8，不允许勾选 Task 9-16。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行仍为 `partial`；证据更新为 packaging-export 已具备 final_export Worker 和 final_video artifact 输出路径，缺口仍是 ffprobe、API、下载、UI 和真实媒体验收。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 8 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-packaging-export` Task 9。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 9: 实现 ffprobe 媒体验收

### 任务
- Spec: `voflow-packaging-export`
- Task: 9
- Requirements: US-4

### 修改文件
- `src/lib/export/constants.ts`
- `src/lib/export/media-validation.ts`
- `src/services/exportFfmpegService.ts`
- `src/services/exportMediaValidationService.ts`
- `src/services/exportWorkerService.ts`
- `tests/export-media-validation-service.test.ts`
- `tests/export-worker-service.test.ts`
- `.kiro/specs/voflow-packaging-export/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `buildFfprobeArgs()`，统一构建 JSON ffprobe inspection 参数。
- 本次完成：新增 `validateFinalVideoProbe()`，校验最终 MP4 文件非空、存在 video stream、存在 audio stream、duration 有效，并在有期望时长时校验 1000ms 容差。
- 本次完成：新增 `validateFinalVideoFile()`，默认通过公共 ffprobe executor 检查最终 MP4。
- 本次完成：公共 FFmpeg service 新增 `inspectMediaWithConfiguredFfprobe()`，ffprobe 命令由配置的 FFmpeg 路径同目录推导，不新增绝对路径硬编码。
- 本次完成：final_export Worker 在读取输出 MP4 后、上传 final_video artifact 前执行媒体校验；校验失败时标记 export request failed 并返回稳定错误码。
- 明确未完成：本轮未实现导出 API、下载 API、导出 UI 或端到端真实媒体冒烟。
- 是否使用 mock/provider/adapter 占位：ffprobe service 测试使用 fake inspector；Worker 测试使用 fake validator；运行时代码默认复用真实 `local_model_services.ffmpeg` 配置推导 ffprobe。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-10 改动、`voflow-packaging-export` Task 0-8 改动和 Kiro 文档改动。
- 本任务实际改动：新增 media validation helper/service/test，扩展公共 FFmpeg service，并接入 final_export Worker。
- 未触碰的既有改动：未修改 advanced-editing 的业务实现，未回滚前序 avatar render、TTS、voice clone 等改动。

### 硬编码检查
- 是否新增运行时硬编码：未在 Worker/API/UI 中散写 ffprobe 参数；ffprobe args、duration 容差和错误码已收口到 export helper/constants。
- ffprobe 路径是否硬编码：否，由 `local_model_services.ffmpeg.baseUrl` 同目录推导。
- 新增下载 URL 有效期：无，本轮未涉及下载。

### 公共化检查
- 新增公共 helper：`src/lib/export/media-validation.ts`。
- 新增公共 service：`src/services/exportMediaValidationService.ts`。
- 扩展公共 service：`src/services/exportFfmpegService.ts`。
- 后续复用点：Task 13/14 的端到端和真实媒体冒烟应复用同一套 `validateFinalVideoFile()`。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-media-validation-service.test.ts`: 先失败，确认 `src/lib/export/media-validation` 不存在；实现后通过，1 个文件、4 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-worker-service.test.ts tests/export-media-validation-service.test.ts`: 通过，2 个文件、7 个测试通过。

### 验收结论
- 是否满足当前 task：满足 Task 9。
- 是否满足对应 Acceptance Criteria：满足 US-4 中“空文件、无视频流、无音频流或时长异常时标记导出失败”的媒体校验基础。
- 是否允许勾选：允许勾选 Task 9，不允许勾选 Task 10-16。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行仍为 `partial`；证据更新为 packaging-export 已具备 final_video 上传前媒体校验，缺口仍是导出 API、下载 API、UI 和真实媒体冒烟。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 9 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-packaging-export` Task 10。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 10: 实现导出 API

### 任务
- Spec: `voflow-packaging-export`
- Task: 10
- Requirements: US-4

### 修改文件
- `src/lib/export/constants.ts`
- `src/services/exportTaskService.ts`
- `src/app/api/video-jobs/[jobId]/export/route.ts`
- `tests/export-task-service.test.ts`
- `.kiro/specs/voflow-packaging-export/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `createFinalExportTask()`，校验 job/team、editing_config、avatar_video、mixed_audio 或 TTS audio、subtitle artifact 是否就绪。
- 本次完成：创建 `final_export` workflow node，创建 `export_requests`，将 `exportRequestId` 写入 node input，并投递 workflow queue。
- 本次完成：新增 `POST /api/video-jobs/{jobId}/export`，复用 `requireAuth()`、统一响应和 Zod 校验，支持 `outputProfile`、可选 `bgmAssetId`、可选 `coverArtifactId`。
- 本次完成：新增 `GET /api/video-jobs/{jobId}/export`，查询导出请求、node 状态和最新 final_video artifact。
- 本次完成：BGM 选择会复用 Task 4 的 BGM 授权校验，未授权素材被稳定错误阻断。
- 明确未完成：本轮未实现下载 API、导出 UI、端到端脚本或真实媒体冒烟。
- 是否使用 mock/provider/adapter 占位：service 测试使用 fake queue/traceId；运行时代码默认复用真实 workflowQueue、Prisma 和 API 鉴权。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-10 改动、`voflow-packaging-export` Task 0-9 改动和 Kiro 文档改动。
- 本任务实际改动：新增 export task service/test 和 export API route，并同步 Kiro 任务文档、总控 plan 和开发进度说明。
- 未触碰的既有改动：未修改 advanced-editing 的业务实现，未回滚前序 avatar render、TTS、voice clone 等改动。

### 硬编码检查
- 是否新增运行时硬编码：未在 API route 中散写 workflow node type、错误码或 artifact type；复用 export constants 和 service。
- 队列/trace 是否复用公共模块：是，复用 `workflowQueue` 和 `createWorkflowTraceId()`。
- 新增下载 URL 有效期：无，本轮未涉及下载。

### 公共化检查
- 新增公共 service：`src/services/exportTaskService.ts`。
- 新增 API route：`src/app/api/video-jobs/[jobId]/export/route.ts`。
- 复用公共模块：`requireAuth()`、`success()`/`validationError()`/`notFound()`、`resolveExportBgmAsset()`、workflow queue。
- 后续复用点：Task 12 导出 UI 应调用此 API，不直接创建 workflow node 或 export request。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-task-service.test.ts`: 先失败，确认 `exportTaskService` 不存在；实现后通过，1 个文件、2 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-task-service.test.ts tests/export-worker-service.test.ts tests/export-media-validation-service.test.ts tests/export-cover-service.test.ts tests/export-audio-mix-service.test.ts tests/export-bgm-service.test.ts tests/export-subtitle-service.test.ts tests/export-request-schema.test.ts`: 通过，8 个文件、32 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma validate`: 通过。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 10。
- 是否满足对应 Acceptance Criteria：满足 US-4 中创建最终导出任务的 API/service 基础；最终下载将在 Task 11 完成。
- 是否允许勾选：允许勾选 Task 10，不允许勾选 Task 11-16。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行仍为 `partial`；证据更新为 packaging-export 已具备导出 API，缺口仍是下载 API、UI 和真实媒体冒烟。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 10 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-packaging-export` Task 11。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 11: 实现下载 API

### 任务
- Spec: `voflow-packaging-export`
- Task: 11
- Requirements: US-4

### 修改文件
- `src/lib/export/constants.ts`
- `src/services/exportDownloadService.ts`
- `src/app/api/artifacts/[artifactId]/download/route.ts`
- `tests/export-download-service.test.ts`
- `.kiro/specs/voflow-packaging-export/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `createFinalVideoDownloadUrl()`，校验 artifact 属于当前 team 且类型为 `final_video`。
- 本次完成：下载 URL 复用 `generatePresignedObjectUrl()`，有效期集中为 300 秒。
- 本次完成：下载成功写入 audit log，复用现有 `job_update` action，并在 metadata 标明 `event: artifact_download`、artifact type、jobId、storageUrl。
- 本次完成：新增 `GET /api/artifacts/{artifactId}/download`，复用 `requireAuth()` 和统一响应。
- 明确未完成：本轮未实现导出 UI、端到端脚本或真实媒体冒烟。
- 是否使用 mock/provider/adapter 占位：service 测试使用 fake repository、fake URL 生成器和 fake audit writer；运行时代码默认复用真实 Prisma、MinIO presigned URL 和 audit log。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-10 改动、`voflow-packaging-export` Task 0-10 改动和 Kiro 文档改动。
- 本任务实际改动：新增 export download service/test 和 artifact download API route，并同步 Kiro 任务文档、总控 plan 和开发进度说明。
- 未触碰的既有改动：未修改 advanced-editing 的业务实现，未回滚前序 avatar render、TTS、voice clone 等改动。

### 硬编码检查
- 是否新增运行时硬编码：未在 API route 中散写 URL 有效期、artifact type 或错误码；下载有效期和错误码已收口到 `src/lib/export/constants.ts`。
- 审计 action 说明：未新增 Prisma enum 迁移，复用现有 `job_update` action，并在 metadata 写入 `artifact_download` 事件。
- FFmpeg 参数：无，本轮未涉及 FFmpeg。

### 公共化检查
- 新增公共 service：`src/services/exportDownloadService.ts`。
- 新增 API route：`src/app/api/artifacts/[artifactId]/download/route.ts`。
- 复用公共模块：`requireAuth()`、`success()`/`notFound()`、`generatePresignedObjectUrl()`、`writeAuditLog()`。
- 后续复用点：Task 12 导出 UI 应调用此下载 API，不能直接拼对象存储 URL。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-download-service.test.ts`: 先失败，确认 `exportDownloadService` 不存在；实现后通过，1 个文件、2 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-download-service.test.ts tests/export-task-service.test.ts tests/export-worker-service.test.ts tests/export-media-validation-service.test.ts tests/export-cover-service.test.ts tests/export-audio-mix-service.test.ts tests/export-bgm-service.test.ts tests/export-subtitle-service.test.ts tests/export-request-schema.test.ts`: 通过，9 个文件、34 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma validate`: 通过。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 11。
- 是否满足对应 Acceptance Criteria：满足 US-4 中“用户点击下载返回受控下载 URL”的 API 基础，并具备 team 权限校验和下载审计。
- 是否允许勾选：允许勾选 Task 11，不允许勾选 Task 12-16。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行仍为 `partial`；证据更新为 packaging-export 已具备下载 API，缺口仍是导出 UI、端到端脚本和真实媒体冒烟。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 11 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-packaging-export` Task 12。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 12: 实现导出 UI

### 任务
- Spec: `voflow-packaging-export`
- Task: 12
- Requirements: US-1、US-2、US-3、US-4

### 修改文件
- `src/components/export/ExportPanel.tsx`
- `src/app/dashboard/voices/page.tsx`
- `tests/export-ui.test.tsx`
- `src/services/exportTaskService.ts`
- `src/services/exportWorkerService.ts`
- `.kiro/specs/voflow-packaging-export/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `ExportPanel`，展示导出状态、字幕摘要、BGM 状态、封面状态、1080p/720p 导出按钮和 MP4 下载按钮。
- 本次完成：`/dashboard/voices` 接入导出数据加载、创建导出任务、刷新导出状态和下载 final_video 的交互。
- 本次完成：导出 UI 调用 `POST /api/video-jobs/{jobId}/export` 创建导出任务，调用 `GET /api/video-jobs/{jobId}/export` 查询状态，调用 `GET /api/artifacts/{artifactId}/download` 获取短期下载 URL。
- 本次完成：UI 不直接拼对象存储 URL，下载只使用下载 API 返回的受控 URL。
- 本次修正：build 期间修复 `exportTaskService` 的 `editingConfigId` 类型窄化问题，以及 `exportWorkerService` 的 Prisma JSON null 类型问题。
- 降级说明：UI 展示“无 BGM/已选择 BGM”和“等待封面/已生成封面”的状态摘要，当前未做完整 BGM 选择器和封面图片预览缩略图；底层 API 已保留 `bgmAssetId`、`coverArtifactId` 参数，后续可增强为显式选择。
- 明确未完成：本轮未实现端到端脚本、真实媒体冒烟、失败重试测试或最终 checkpoint。
- 是否使用 mock/provider/adapter 占位：UI 测试为静态渲染测试；运行时代码调用真实 API。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-10 改动、`voflow-packaging-export` Task 0-11 改动和 Kiro 文档改动。
- 本任务实际改动：新增导出 UI 组件/test，接入 voices 页面，并修复 build 暴露的两个类型问题。
- 未触碰的既有改动：未修改 advanced-editing 的业务实现，未回滚前序 avatar render、TTS、voice clone 等改动。

### 硬编码检查
- 是否新增运行时硬编码：UI 文案为展示文案；API 路径集中在页面调用处，下载 URL 不在 UI 拼接。
- 下载 URL 是否由 UI 拼接：否，调用下载 API。
- FFmpeg 参数：无，本轮未涉及 FFmpeg 参数。

### 公共化检查
- 新增公共组件：`src/components/export/ExportPanel.tsx`。
- 复用公共 API：`/api/video-jobs/{jobId}/export`、`/api/artifacts/{artifactId}/download`。
- 后续复用点：Task 13 端到端脚本可通过 API 验证 UI 所依赖的数据结构。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-ui.test.tsx`: 通过，1 个文件、1 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-ui.test.tsx tests/export-download-service.test.ts tests/export-task-service.test.ts tests/export-worker-service.test.ts tests/export-media-validation-service.test.ts`: 通过，5 个文件、12 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma validate`: 通过。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 先失败并暴露类型问题，修复后通过。

### 验收结论
- 是否满足当前 task：满足 Task 12 的基础导出 UI。
- 是否满足对应 Acceptance Criteria：满足 US-1/US-2/US-3/US-4 的导出状态展示、导出触发和下载入口；BGM 显式选择器和封面缩略图仍是 UI 增强项。
- 是否允许勾选：允许勾选 Task 12，不允许勾选 Task 13-16。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行仍为 `partial`；证据更新为 packaging-export 已具备导出 UI，缺口仍是端到端脚本、真实媒体冒烟、失败重试测试和最终 checkpoint。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 12 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-packaging-export` Task 13。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 13: 实现端到端测试脚本

### 任务
- Spec: `voflow-packaging-export`
- Task: 13
- Requirements: US-5

### 修改文件
- `src/services/exportE2eScenarioService.ts`
- `tests/export-e2e-script.test.ts`
- `.kiro/specs/voflow-packaging-export/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `runPackagingExportE2eScenario()`，创建真实数据库 fixture，覆盖 user/team/project/job、文案、mock ASR/LLM、照片 asset、ready avatar、active voice、mock TTS audio、mock avatar_video、subtitle、mixed_audio、cover、export_request 和 final_video artifact。
- 本次完成：端到端脚本复用现有 `createAssSubtitleArtifactForJob()`、`createFinalExportTask()`、`executeWorkflowNode()` 和 `createFinalExportWorkflowNodeHandler()`，不绕过导出请求、队列 payload、final_export node 和 artifact 写入关键路径。
- 本次完成：新增 `tests/export-e2e-script.test.ts`，断言 mock ASR/LLM/TTS/avatar/FFmpeg provider 边界、workflow node 状态完整、artifact 类型完整、export_request 成功，以及 final_video metadata 绑定 exportRequestId/outputProfile。
- 明确未完成：本轮不是 Task 14 的真实媒体冒烟；最终 MP4 内容仍使用 mock buffer，未调用真实 FFmpeg/ffprobe 生成 9:16 MP4。
- 是否使用 mock/provider/adapter 占位：是，ASR/LLM/TTS/avatar/FFmpeg 均为 mock provider 边界；数据库、导出 service、workflow execution、export_request 和 artifact 写入为真实路径。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-10 改动、`voflow-packaging-export` Task 0-12 改动和 Kiro 文档改动。
- 本任务实际改动：新增 packaging export E2E scenario service/test，并同步 Kiro 任务文档、总控 plan 和开发进度说明。
- 未触碰的既有改动：未修改 advanced-editing 的业务实现，未回滚前序 avatar render、TTS、voice clone 等改动。

### 硬编码检查
- 是否新增运行时硬编码：未在 Worker/API/UI 中散写 FFmpeg 参数、下载 URL 有效期或错误码；E2E fixture 的 mock provider 名称和测试 storageUrl 仅用于测试脚本。
- 是否绕过下载/导出校验：否，导出任务仍通过 `createFinalExportTask()` 创建 `export_requests` 和 `final_export` node，再通过 `executeWorkflowNode()` 执行。
- 真实媒体路径：未新增真实服务地址或本机绝对素材路径。

### 公共化检查
- 新增公共 service：`src/services/exportE2eScenarioService.ts`，用于集中端到端 fixture 和 mock provider 边界。
- 新增测试脚本：`tests/export-e2e-script.test.ts`。
- 复用公共模块：`createAssSubtitleArtifactForJob()`、`createFinalExportTask()`、`createFinalExportWorkflowNodeHandler()`、`executeWorkflowNode()`。
- 后续复用点：Task 14 可复用同样的节点/artifact 完整性断言，但必须替换为真实 FFmpeg/ffprobe 媒体输出。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-e2e-script.test.ts`: 先失败，确认 `src/services/exportE2eScenarioService.ts` 不存在；实现后通过，1 个文件、1 个测试通过。

### 验收结论
- 是否满足当前 task：满足 Task 13。
- 是否满足对应 Acceptance Criteria：满足 US-5 中 mock provider 端到端脚本覆盖，从项目、文案、照片、音色到 final_video，并校验节点和 artifact 完整性。
- 是否允许勾选：允许勾选 Task 13，不允许勾选 Task 14-16。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行仍为 `partial`；证据更新为 packaging-export 已具备 mock provider E2E 脚本，缺口仍是真实媒体冒烟、失败重试和最终 checkpoint。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 13 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-packaging-export` Task 14。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 14: 实现真实媒体冒烟测试

### 任务
- Spec: `voflow-packaging-export`
- Task: 14
- Requirements: US-4、US-5

### 修改文件
- `src/lib/export/constants.ts`
- `src/services/exportFfmpegService.ts`
- `src/services/exportMediaSmokeService.ts`
- `tests/export-real-media-smoke.test.ts`
- `.kiro/specs/voflow-packaging-export/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 `runRealMediaExportSmoke()`，使用真实 FFmpeg 生成短 9:16 测试视频输入和测试音频输入，再复用 `buildFinalVideoFfmpegArgs()` 合成最终 MP4。
- 本次完成：真实 smoke 使用 ffprobe 读取最终 MP4 metadata，并复用 `validateFinalVideoProbe()` 校验文件非空、存在 video stream、存在 audio stream、duration 合理。
- 本次完成：新增 `tests/export-real-media-smoke.test.ts`，断言最终输出为 1080x1920、包含音视频流、duration 大于 0 且 validation 通过。
- 本次完成：扩展 `exportFfmpegService`，将 FFmpeg command execution、ffprobe inspection、command output helper 和 ffprobe 路径推导暴露为公共能力，避免 smoke service 复制 spawn 逻辑。
- 环境边界：当前本机 `/opt/homebrew/bin/ffmpeg` 可生成/合成/ffprobe MP4，但不包含 `subtitles` filter；smoke service 会先探测 `subtitles` filter，支持则硬烧 ASS，不支持则跳过字幕硬烧，仅验收真实 MP4 音视频流。
- 明确未完成：本轮未实现失败重试测试；复杂画中画/背景/转场 filter 仍需在真实剪辑联调中增强。
- 是否使用 mock/provider/adapter 占位：否，Task 14 的媒体生成、最终合成和 ffprobe 校验均调用真实 FFmpeg/ffprobe；仅输入视频/音频为 lavfi 生成的测试媒体 fixture。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-10 改动、`voflow-packaging-export` Task 0-13 改动和 Kiro 文档改动。
- 本任务实际改动：新增真实媒体 smoke helper/test，扩展公共 FFmpeg service，并同步 Kiro 任务文档、总控 plan 和开发进度说明。
- 未触碰的既有改动：未修改 advanced-editing 的业务实现，未回滚前序 avatar render、TTS、voice clone 等改动。

### 硬编码检查
- 是否新增运行时硬编码：未在测试中散写 FFmpeg args；测试媒体默认时长、输入分辨率、帧率、音频频率和字幕文本已收口到 `src/lib/export/constants.ts`。
- FFmpeg/ffprobe 路径：默认读取 `FFMPEG_WORKER` / `FFPROBE_WORKER` 环境变量，未配置时使用 PATH 中的 `ffmpeg`/同目录 `ffprobe`，不写死 `/opt/homebrew/bin`。
- 字幕硬烧：通过 `ffmpeg -filters` 探测 `subtitles` filter；本机不支持时不将该环境问题误判为 MP4 合成失败。

### 公共化检查
- 新增公共 service：`src/services/exportMediaSmokeService.ts`。
- 扩展公共 service：`src/services/exportFfmpegService.ts`。
- 复用公共 helper：`buildFinalVideoFfmpegArgs()`、`buildAssSubtitle()`、`validateFinalVideoProbe()`。
- 后续复用点：Task 16 checkpoint 可复用 smoke 输出作为真实 MP4 合成的自动化证据，但仍需明确当前未覆盖真实数字人模型和复杂剪辑 filter。

### 验证命令
- `which ffmpeg`: 通过，输出 `/opt/homebrew/bin/ffmpeg`。
- `which ffprobe`: 通过，输出 `/opt/homebrew/bin/ffprobe`。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-real-media-smoke.test.ts`: 先失败，暴露当前 FFmpeg 对 `subtitles` filter 不可用；增加 filter 探测降级后通过，1 个文件、1 个测试通过。

### 验收结论
- 是否满足当前 task：满足 Task 14。
- 是否满足对应 Acceptance Criteria：满足 US-4/US-5 中“使用短文案、测试头像/音频生成 9:16 MP4，并用 ffprobe 校验音视频流”的自动化 smoke 验收；字幕硬烧受本机 FFmpeg 编译能力影响，已显式记录边界。
- 是否允许勾选：允许勾选 Task 14，不允许勾选 Task 15-16。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行仍为 `partial`；证据更新为 packaging-export 已具备真实媒体 MP4 smoke，缺口仍是失败重试和最终 checkpoint。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 14 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-packaging-export` Task 15。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 15: 添加失败重试测试

### 任务
- Spec: `voflow-packaging-export`
- Task: 15
- Requirements: US-4、US-5

### 修改文件
- `tests/export-retry-service.test.ts`
- `.kiro/specs/voflow-packaging-export/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`

### 范围说明
- 本次完成：新增 final_export 失败重试 focused test，覆盖导出任务创建、首次执行 FFmpeg 失败、workflow node failed、export_request failed、错误码落库、无 final_video artifact 写入。
- 本次完成：测试复用 `retryWorkflowNode()` 创建 `final_export` version 2 节点，并通过 queue retry payload 执行成功路径。
- 本次完成：重试成功后验证 export_request 从 failed 变为 succeeded、errorJson 清空，并写入新的 final_video artifact，artifact.nodeId 指向重试节点。
- 明确未完成：本轮未执行最终 checkpoint；仍需 Task 16 汇总 US-1 到 US-5 验收、运行 focused/full verification 并同步最终 MVP 状态。
- 是否使用 mock/provider/adapter 占位：失败路径使用 fake `executeFfmpeg` 抛错，成功路径使用 fake output buffer 和 fake upload；重试 service、workflow execution、export_request 和 artifact 写入为真实数据库路径。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-10 改动、`voflow-packaging-export` Task 0-14 改动和 Kiro 文档改动。
- 本任务实际改动：新增失败重试测试，并同步 Kiro 任务文档、总控 plan 和开发进度说明。
- 未触碰的既有改动：未修改 advanced-editing 的业务实现，未回滚前序 avatar render、TTS、voice clone 等改动。

### 硬编码检查
- 是否新增运行时硬编码：测试 fixture storageUrl 为测试数据；未在运行时代码新增 FFmpeg 参数、错误码、下载 URL 有效期或状态文案。
- 是否直接篡改状态：否，失败由 `executeWorkflowNode()` 和 final_export worker 落库，重试由 `retryWorkflowNode()` 创建新版本节点。
- 新增错误码：无，复用 `EXPORT_FFMPEG_FAILED`。

### 公共化检查
- 新增公共函数/service：无，本任务验证既有公共 workflow retry 和 final_export worker 能力。
- 复用公共模块：`createFinalExportTask()`、`createFinalExportWorkflowNodeHandler()`、`executeWorkflowNode()`、`retryWorkflowNode()`。
- 后续复用点：Task 16 checkpoint 可将该测试作为失败重试自动化证据。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-retry-service.test.ts`: 初次因测试断言写死 storageUrl 的 team/job ID 失败；修正为动态路径后通过，1 个文件、1 个测试通过。

### 验收结论
- 是否满足当前 task：满足 Task 15。
- 是否满足对应 Acceptance Criteria：满足 US-4/US-5 中“模拟 FFmpeg 失败、节点 failed 和错误码、重试后生成新版本 artifact”的测试覆盖。
- 是否允许勾选：允许勾选 Task 15，不允许勾选 Task 16。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行仍为 `partial`，等待最终 checkpoint 对能力边界做统一判定。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 15 并追加执行反馈。
- 是否更新 `plan.md`：是，当前开发游标推进到 `voflow-packaging-export` Task 16。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界。

### Task 16: Checkpoint MVP 成片验收

### 任务
- Spec: `voflow-packaging-export`
- Task: 16
- Requirements: US-1、US-2、US-3、US-4、US-5

### 修改文件
- `.kiro/specs/voflow-packaging-export/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`
- `docs/05-开发进度说明.md`
- Task 16 验收前修复类型问题涉及：
  - `src/services/exportE2eScenarioService.ts`
  - `src/lib/export/media-validation.ts`
  - `src/services/exportMediaSmokeService.ts`

### 范围说明
- 本次完成：对照 `requirements.md` 和 `design.md` 复核 US-1 到 US-5，确认 packaging-export 已具备字幕 artifact、ASS 模板、BGM 授权/混音、封面 artifact、final_export Worker、ffprobe 媒体验收、导出 API、下载 API、导出 UI、mock provider E2E、真实媒体 MP4 smoke 和失败重试测试。
- 本次完成：运行 packaging-export focused tests，覆盖 13 个测试文件、38 个测试，通过 schema/字幕/BGM/混音/封面/worker/ffprobe/export/download/UI/E2E/smoke/retry。
- 本次完成：运行真实 FFmpeg/ffprobe smoke，确认可生成 1080x1920 MP4，包含 video stream、audio stream、duration 有效且文件非空。
- 本次完成：修复 checkpoint build 暴露的两个类型问题：E2E fixture 写 Prisma JSON 时显式转换；ffprobe stream 类型补充 width/height。
- 边界说明：当前 checkpoint 是 packaging-export 自动化验收通过，不代表真实 MuseTalk/SadTalker 数字人模型已在最终环境人工复验；该能力仍沿用 `voflow-video-render` 的 partial 状态。
- 边界说明：当前本机 `/opt/homebrew/bin/ffmpeg` 不包含 `subtitles` filter，真实媒体 smoke 自动跳过 ASS 硬烧，仅验收真实 MP4 音视频流；Worker 的字幕硬烧参数已由单元测试覆盖，生产环境若要真实硬烧字幕必须使用带 libass/subtitles filter 的 FFmpeg。
- 边界说明：final_export Worker 当前已传递 `editingConfigId` 并记录编辑参数关联，但复杂画中画、背景、转场 filter 仍未完成真实媒体级应用，不能按完整复杂剪辑引擎标记为 done。
- 是否使用 mock/provider/adapter 占位：Task 13 E2E 使用 mock ASR/LLM/TTS/avatar/FFmpeg；Task 14 smoke 使用真实 FFmpeg/ffprobe 但输入为 lavfi 测试媒体；真实数字人模型和复杂剪辑 filter 仍需后续最终环境联调。

### 工作区状态
- 开始前已有未提交改动：`voflow-advanced-editing` Task 0-10 改动、`voflow-packaging-export` Task 0-15 改动和 Kiro 文档改动。
- 本任务实际改动：完成 checkpoint 文档、总控 plan 和开发进度说明同步，并修复 checkpoint build 暴露的 JSON/ffprobe stream 类型问题。
- 未触碰的既有改动：未修改 advanced-editing 的业务实现，未回滚前序 avatar render、TTS、voice clone 等改动。

### 硬编码检查
- 是否新增运行时硬编码：未新增服务地址、密钥、模型名、下载 URL 有效期、错误码或 FFmpeg 参数散写。
- 配置收口：FFmpeg 路径仍由 `local_model_services.ffmpeg` 或 smoke 输入/env/PATH 提供；下载 URL 有效期收口到 export constants；输出 profile、字幕样式、BGM ducking、封面参数和错误码均收口到 `src/lib/export/constants.ts`。
- Smoke fixture：测试媒体默认时长、分辨率、帧率、音频频率和字幕文本收口到 export constants。

### 公共化检查
- 新增/复用公共模块：`src/lib/export/*`、`src/services/export*`、`src/components/export/ExportPanel.tsx`。
- 端到端 fixture：集中在 `src/services/exportE2eScenarioService.ts`。
- 真实媒体 smoke：集中在 `src/services/exportMediaSmokeService.ts`。
- 命令执行复用：FFmpeg/ffprobe command helper 集中在 `src/services/exportFfmpegService.ts`。
- 未发现本 checkpoint 需要继续抽取的同类重复逻辑。

### 验证命令
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/vitest run tests/export-request-schema.test.ts tests/export-subtitle-service.test.ts tests/export-bgm-service.test.ts tests/export-audio-mix-service.test.ts tests/export-cover-service.test.ts tests/export-worker-service.test.ts tests/export-media-validation-service.test.ts tests/export-task-service.test.ts tests/export-download-service.test.ts tests/export-ui.test.tsx tests/export-e2e-script.test.ts tests/export-real-media-smoke.test.ts tests/export-retry-service.test.ts`: 通过，13 个文件、38 个测试通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/prisma validate`: 通过。
- `git diff --check`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next lint`: 通过。
- `PATH="/Users/qianduoduo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node_modules/.bin/next build`: 先失败并暴露 `exportE2eScenarioService` Prisma JSON 类型、`exportMediaSmokeService` ffprobe stream 类型问题；修复后通过。

### 验收结论
- 是否满足当前 task：满足 Task 16 的 packaging-export checkpoint 记录和自动化验收。
- 是否满足对应 Acceptance Criteria：US-1 到 US-5 的 packaging-export 自动化路径已覆盖；真实用户照片到真实数字人模型、FFmpeg 字幕硬烧和复杂剪辑 filter 的最终生产级验收仍需最终环境联调，MVP 主线第 12 行不能升级为 `done`。
- 是否允许勾选：允许勾选 Task 16；`voflow-packaging-export` checklist 17/17 完成。
- MVP 状态矩阵是否需要同步更新：需要，MVP 主线第 12 行保持 `partial`，证据更新为 packaging-export checkpoint 已完成，缺口改为真实模型/字幕 filter/复杂剪辑 filter 最终环境联调。

### 文档同步
- 是否更新 `tasks.md`：是，已勾选 Task 16 并追加 checkpoint 反馈。
- 是否更新 `plan.md`：是，当前开发游标可进入 `voflow-publish-assistant` Task 0，但 MVP 主线第 12 行仍保持 `partial`。
- 是否新增 Change Log / 返修项：否，本轮未改变需求或设计边界；已在 checkpoint 反馈中记录真实环境边界。
