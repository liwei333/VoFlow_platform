# VoFlow Platform Kiro Spec 拆分计划

版本：v0.1
日期：2026-06-19
来源文档：

- `docs/01-智能口播平台需求文档.md`
- `docs/02-智能口播平台开发技术文档.md`

## 1. 拆分结论

VoFlow Platform MVP 需要拆分为多个 Spec。原因：

1. 功能边界多：账号工作台、素材合规、任务引擎、本地模型监控、爆款提取、文案 AI、AI 法务审查、TTS、声音克隆、自拍数字人、数字人口播渲染、高级剪辑、字幕/BGM/导出、多平台发布。
2. 技术层级多：Web、API、数据库、对象存储、队列、AI Worker、GPU 模型服务、FFmpeg。
3. 风险差异大：自拍数字人和授权合规需要独立验收，不能混在视频生成任务里。
4. 任务数量超过单 Spec 可控范围，需要分批交付和分批验收。

## 2. Spec 列表

| 批次 | Spec | 目标 | 依赖 |
| --- | --- | --- | --- |
| 1 | `voflow-foundation` | 项目基础、账号、工作台、项目模型、运行环境 | 无 |
| 1 | `voflow-assets-compliance` | 素材上传、对象存储、授权记录、审计日志 | `voflow-foundation` |
| 1 | `voflow-workflow-engine` | 异步任务、工作流节点、状态机、重试、产物记录 | `voflow-foundation`, `voflow-assets-compliance` |
| 1 | `voflow-local-model-monitor` | 本地 LLM/ASR/TTS/数字人/FFmpeg 服务配置、状态和健康检查 | `voflow-foundation` |
| 2 | `voflow-reference-extract` | 爆款链接导入、平台识别、音视频解析、ASR 转写、钩子/节奏/卖点提取 | `voflow-workflow-engine`, `voflow-local-model-monitor` |
| 2 | `voflow-reference-url-import` | 基于 yt-dlp 的公开参考链接 metadata、字幕、授权后音频导入 | `voflow-reference-extract`, `voflow-assets-compliance`, `voflow-workflow-engine`, `voflow-local-model-monitor` |
| 2 | `voflow-script-ai` | 文案输入、ASR 转写、本地大模型文案改写、标题生成、风险检查 | `voflow-workflow-engine`, `voflow-local-model-monitor` |
| 2 | `voflow-legal-review` | AI 法务审查、违禁敏感词、夸大宣传、替换建议、人工确认 | `voflow-script-ai` |
| 2 | `voflow-tts` | 预置音色、TTS 任务、音频产物、试听和确认 | `voflow-workflow-engine`, `voflow-assets-compliance` |
| 2 | `voflow-voice-clone` | 上传声音样本、声音授权、本地训练、克隆音色管理 | `voflow-tts`, `voflow-assets-compliance` |
| 2 | `voflow-self-avatar` | 拍照/上传本人照片、照片质检、肖像授权、我的数字人 | `voflow-assets-compliance` |
| 3 | `voflow-video-render` | 用音频驱动数字人生成口播视频，支持预览/高清 | `voflow-tts`, `voflow-voice-clone`, `voflow-self-avatar`, `voflow-workflow-engine` |
| 3 | `voflow-advanced-editing` | 字幕样式、画中画、背景素材、片头片尾、转场和剪辑预览 | `voflow-video-render`, `voflow-assets-compliance` |
| 3 | `voflow-packaging-export` | 字幕、BGM、封面、最终 MP4 合成、下载、端到端验收 | `voflow-legal-review`, `voflow-video-render`, `voflow-advanced-editing` |
| 4 | `voflow-publish-assistant` | 平台发布信息、账号授权、参数检查、一键发布、状态同步和重试 | `voflow-packaging-export` |

## 3. 批次目标

## 3.0 后续开发执行规范

从当前 `voflow-assets-compliance` 未完成任务开始，所有后续 Spec 执行必须先遵守 `docs/03-VoFlow开发执行规范.md`。

执行约束：

1. 不得在运行时代码、Worker、API route 或前端业务逻辑中新增服务地址、密钥、模型名、平台列表、状态文案、错误码、MIME 白名单、大小限制等硬编码。
2. 新增配置必须收口到 `src/lib/config.ts` 或等价配置模块；生产关键密钥缺失时必须 fail fast。
3. 新增 API 必须复用统一鉴权、统一响应、统一 Zod 错误处理和 serializer；如果公共模块缺失，先补公共模块。
4. 同类逻辑第二次出现时必须抽公共函数或公共常量，不能复制粘贴到后续 Spec。
5. 每个 Checkpoint 必须反馈硬编码检查、公共函数提取情况，以及实际运行的验证命令。

### Batch 1：平台底座

交付可运行的 Web/API/DB/对象存储/队列基础，用户能登录、创建项目、上传素材，任务中心能展示工作流状态，本地模型页面能展示各模型服务健康状态。

### Batch 2：AI 输入与核心素材

交付爆款链接提取、公开参考链接真实导入、文案、法务审查、语音克隆和自拍数字人能力线。完成后，系统具备“爆款参考 -> 合规文案 -> 音频”和“照片 -> 我的数字人”的可复用资产。

文案改写和标题生成默认使用本地大模型服务，不依赖线上大模型 API。

### Batch 3：成片闭环

交付“文案 + 音色/克隆音色 + 我的数字人 -> 口播视频 -> 字幕/BGM/画中画/封面 -> MP4 下载”的成片闭环。

### Batch 4：发布闭环

交付“发布元信息 -> 多平台参数检查 -> 一键发布 -> 发布状态同步 -> 失败重试”的发布辅助闭环。

## 4. MVP 验收主线状态矩阵

状态含义：

- `done`：已实现并有当前可复验的自动化测试或验收记录。
- `partial`：已有基础能力，但存在 mock/provider 占位、真实服务未接入、端到端联调缺口或验收口径待收口。
- `not_started`：对应 Spec 尚未开始实现。
- `blocked`：受外部依赖、环境或上游任务阻塞。

| # | 验收步骤 | 负责 Spec | 当前状态 | 当前证据 | 缺口 |
| --- | --- | --- | --- | --- | --- |
| 1 | 用户登录工作台 | `voflow-foundation` | done | `tests/api.test.ts`, 登录页和工作台基础页 | 需在最终 MVP 环境复验 |
| 2 | 用户创建一个 9:16 项目 | `voflow-foundation` | done | 项目 API/UI 测试 | 需在最终 MVP 环境复验 |
| 3 | 用户上传一张本人正脸照片 | `voflow-self-avatar` | done | `POST /api/avatars/photo-check` 真实 route 验收；`AVATAR_BASE_URL=http://127.0.0.1:7010`，macOS Vision `/detect-face` 在线；正脸图返回 `passed=true` | 需在最终 MVP 环境复验 |
| 4 | 系统完成照片质量检测和肖像授权确认 | `voflow-self-avatar` | done | 五类真实图片 route 验收通过；多人脸/模糊/姿态/曝光异常均返回明确 reason；正脸图完成 `photo-check -> create avatar with consent -> list avatars` | 需在最终 MVP 环境复验 |
| 5 | 系统生成“我的数字人”并在列表中可选 | `voflow-self-avatar` | partial | avatar 创建、授权、列表、删除、设为默认、预览口径测试 | 真实生成预览产物待后续 `voflow-video-render` 写入 |
| 6a | 用户上传参考视频/音频，系统提取原文和结构 | `voflow-reference-extract` | done | `voflow-reference-extract` checkpoint 和相关测试 | 需在最终 MVP 环境复验 |
| 6b | 用户粘贴公开参考链接，系统解析 metadata/字幕/音频并进入结构分析 | `voflow-reference-url-import` | done | `POST /api/projects/{projectId}/references/url/parse` metadata-only 链路、`POST /api/projects/{projectId}/references/{referenceSourceId}/import` 授权确认 API、`reference_url_import` queued workflow node、字幕优先导入生成 Script/AsrSegment/structureJson、授权后音频提取创建 Asset/AssetConsent 并复用 reference_extract、导入成功/失败审计、禁止完整视频/cookie/去水印/批量采集、reference-only 素材用途阻断、爆款提取 UI 展示 metadata/字幕可用性/推荐 importMode/fallback/reference-analysis-only 授权确认、配置/allowlist/feature flag 和 schema/API/worker/UI 测试、Task 12 已补齐 duration/size limit 和 command args 安全覆盖映射、本地运行文档已说明 yt-dlp/ffmpeg/默认禁用/国内平台 fallback、Task 14 checkpoint 已逐条通过 metadata/字幕/音频/fallback/审计日志/focused tests/lint/build 验收 | 需在最终 MVP 环境复验 |
| 7 | 系统提取原文、钩子、节奏和卖点 | `voflow-reference-extract`, `voflow-reference-url-import` | done | 上传素材路径已完成；公开链接 metadata 解析、授权确认 API、queued workflow node、字幕结构分析、无字幕音频 reference_extract 衔接、导入审计/阻断、UI 状态确认、测试清单复核、本地运行文档和 Task 14 checkpoint 已完成；结构分析 Worker 和相关测试 | 需在最终 MVP 环境复验 |
| 8 | 系统生成改写文案和标题候选 | `voflow-script-ai` | done | 文案改写、标题生成、风险检查测试 | 需在最终 MVP 环境复验 |
| 9 | 系统执行 AI 法务审查，给出风险原因和替换建议 | `voflow-legal-review` | done | 法务审查 API/service 测试 | 需在最终 MVP 环境复验 |
| 10 | 用户选择预置音色或克隆音色生成语音 | `voflow-tts`, `voflow-voice-clone` | partial | 预置音色 TTS 已完成；`voflow-voice-clone` Task 0 开发规范检查和任务执行判断已完成 | `voflow-voice-clone` Task 1-11 待实现 |
| 11 | 系统使用我的数字人生成口播视频 | `voflow-video-render` | not_started | - | Spec 未开始 |
| 12 | 系统合成字幕、BGM、画中画、封面和最终 MP4 | `voflow-advanced-editing`, `voflow-packaging-export` | not_started | - | Spec 未开始 |
| 13 | 系统生成各平台标题、标签、描述、话题 | `voflow-publish-assistant` | not_started | - | Spec 未开始 |
| 14 | 用户一键发布到已授权平台，未授权或 token 过期平台给出可处理状态 | `voflow-publish-assistant` | not_started | - | Spec 未开始 |
| 15 | 任务中心展示每个节点状态、产物和失败重试入口 | `voflow-workflow-engine` | partial | workflow engine 任务中心和状态机测试 | 需与后续 reference_url_import/voice_clone/avatar_render/export/publish 节点端到端联调 |

## 5. 后续增强范围

以下能力不进入当前原型对齐版本的必做任务，只保留扩展接口：

1. 企业团队审核流。
2. 复杂封面编辑器。
3. 计费系统。
4. 数据复盘和选题推荐。
5. 发布后评论私信运营。

## 6. 当前开发游标

当前唯一开发入口：

- Active Spec: `voflow-voice-clone`
- Active Scope: 声音克隆开发规范检查与任务启动
- Active Focus: Task 1 创建声音克隆数据表：`voice_samples`、`voice_consents`、`voice_clone_jobs`
- Status: `ready_for_next_task`

未完成当前游标前，不允许并行启动以下新 Spec：

- `voflow-voice-clone`
- `voflow-video-render`
- `voflow-advanced-editing`
- `voflow-packaging-export`
- `voflow-publish-assistant`

进入下一个 Spec 前必须满足：

1. 当前 Spec 的返修项全部记录到对应 `tasks.md`。
2. 当前 Spec 的 Checkpoint 状态与真实能力一致，不得把 mock/provider 占位标记为真实能力完成。
3. `npm run lint` 通过。
4. 当前 Spec 相关测试通过。
5. 若全量测试因外部依赖失败，必须记录依赖、失败命令和失败原因。
6. MVP 状态矩阵中对应行的状态和缺口已同步更新。

## 7. Spec 当前状态表

| Spec | 状态 | 下一步 |
| --- | --- | --- |
| `voflow-foundation` | done | 最终 MVP 环境复验 |
| `voflow-assets-compliance` | done | 最终 MVP 环境复验 |
| `voflow-workflow-engine` | partial | 与后续节点做端到端联调 |
| `voflow-local-model-monitor` | done | 后续真实模型接入时复用 |
| `voflow-reference-extract` | done | 最终 MVP 环境复验 |
| `voflow-reference-url-import` | done | 最终 MVP 环境复验 |
| `voflow-script-ai` | done | 最终 MVP 环境复验 |
| `voflow-legal-review` | done | 最终 MVP 环境复验 |
| `voflow-tts` | done | 与 voice clone 和 avatar render 联调 |
| `voflow-self-avatar` | done | 最终 MVP 环境复验 |
| `voflow-voice-clone` | partial | 继续 Task 1：创建声音克隆数据表 |
| `voflow-video-render` | not_started | 依赖 voice clone/self-avatar/workflow |
| `voflow-advanced-editing` | not_started | 依赖 video render |
| `voflow-packaging-export` | not_started | 依赖 legal-review/video-render/advanced-editing |
| `voflow-publish-assistant` | not_started | 依赖 packaging-export |

## 8. 防漂移执行规则

1. `plan.md` 只维护总控、状态、依赖和 MVP 主线，不写具体 API/字段/页面实现细节。
2. 具体需求以各 Spec 的 `requirements.md` 为准，技术边界以 `design.md` 为准，执行进度以 `tasks.md` 为准。
3. 任务实现中若发现原计划需要拆分、降级为 mock/provider、或新增配置/错误码/状态，必须先更新对应 Spec 文档，再改代码。
4. 任一 Checkpoint 不得只因为 `tasks.md` 全部勾选就视为完成，必须逐条对照 Acceptance Criteria 和 MVP 状态矩阵。
5. 每次任务完成必须按 `docs/03-VoFlow开发执行规范.md` 的执行反馈模板回报。
