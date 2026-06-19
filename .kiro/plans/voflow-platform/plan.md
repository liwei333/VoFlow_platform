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

交付爆款链接提取、文案、法务审查、语音克隆和自拍数字人能力线。完成后，系统具备“爆款参考 -> 合规文案 -> 音频”和“照片 -> 我的数字人”的可复用资产。

文案改写和标题生成默认使用本地大模型服务，不依赖线上大模型 API。

### Batch 3：成片闭环

交付“文案 + 音色/克隆音色 + 我的数字人 -> 口播视频 -> 字幕/BGM/画中画/封面 -> MP4 下载”的成片闭环。

### Batch 4：发布闭环

交付“发布元信息 -> 多平台参数检查 -> 一键发布 -> 发布状态同步 -> 失败重试”的发布辅助闭环。

## 4. MVP 验收主线

1. 用户登录工作台。
2. 用户创建一个 9:16 项目。
3. 用户上传一张本人正脸照片。
4. 系统完成照片质量检测和肖像授权确认。
5. 系统生成“我的数字人”并在列表中可选。
6. 用户粘贴爆款视频链接或上传参考视频。
7. 系统提取原文、钩子、节奏和卖点。
8. 系统生成改写文案和标题候选。
9. 系统执行 AI 法务审查，给出风险原因和替换建议。
10. 用户选择预置音色或克隆音色生成语音。
11. 系统使用我的数字人生成口播视频。
12. 系统合成字幕、BGM、画中画、封面和最终 MP4。
13. 系统生成各平台标题、标签、描述、话题。
14. 用户一键发布到已授权平台，未授权或 token 过期平台给出可处理状态。
15. 任务中心展示每个节点状态、产物和失败重试入口。

## 5. 后续增强范围

以下能力不进入当前原型对齐版本的必做任务，只保留扩展接口：

1. 企业团队审核流。
2. 复杂封面编辑器。
3. 计费系统。
4. 数据复盘和选题推荐。
5. 发布后评论私信运营。
