# Requirements: voflow-local-model-monitor

## Introduction

该 Spec 对齐原型中的“本地模型”页面，用于配置和监控本地 LLM、ASR、TTS、数字人和 FFmpeg 服务。平台默认本地部署，所有 AI 节点必须能读取本地服务状态并在失败时给出明确诊断。

## User Stories

### US-1 服务状态展示

As a 内容运营, I want 查看本地模型服务状态, so that 我知道当前是否可以生成文案、语音和视频。

#### Acceptance Criteria

1. WHEN 用户打开本地模型页面 THEN 系统 SHALL 展示 LLM、ASR、TTS、数字人、FFmpeg 服务卡片。
2. WHEN 服务在线 THEN 系统 SHALL 展示在线状态、服务地址、模型名称、延迟和资源占用。
3. WHEN 服务离线或繁忙 THEN 系统 SHALL 展示对应状态和最近错误。

### US-2 健康检查

As a 开发者, I want 对所有本地服务执行健康检查, so that 可以快速定位本地部署问题。

#### Acceptance Criteria

1. WHEN 用户点击单服务健康检查 THEN 系统 SHALL 调用该服务健康检查 Adapter。
2. WHEN 用户点击全部健康检查 THEN 系统 SHALL 并发检查所有服务。
3. IF 服务检查失败 THEN 系统 SHALL 保存 error_code、error_message 和 checked_at。

### US-3 环境变量配置

As a 开发者, I want 查看本地服务环境变量示例, so that 可以正确部署平台。

#### Acceptance Criteria

1. WHEN 用户打开本地模型页面 THEN 系统 SHALL 展示 LLM_BASE_URL、LLM_MODEL、ASR_BASE_URL、TTS_BASE_URL、AVATAR_BASE_URL、FFMPEG_WORKER、GPU_MODE、QUEUE_REDIS_URL 示例。
2. WHEN 环境变量缺失 THEN 系统 SHALL 在健康状态中标记配置缺失。

## Glossary

| Term | Definition |
| --- | --- |
| 本地模型服务 | 部署在本机或内网的 LLM、ASR、TTS、数字人、FFmpeg 服务 |
| 健康检查 | 对服务地址、模型加载和响应延迟进行检测 |
| 资源占用 | GPU、CPU、队列等本地运行指标 |
