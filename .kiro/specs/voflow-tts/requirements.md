# Requirements: voflow-tts

## Introduction

该 Spec 实现预置音色和克隆音色的 TTS。本地部署默认使用本地 TTS provider，不依赖线上语音服务。声音克隆训练由 `voflow-voice-clone` 负责，本 Spec 负责消费 ready 状态音色并生成口播音频。

## User Stories

### US-1 音色列表

As a 内容运营, I want 选择预置音色或我的克隆音色, so that 我的文案可以生成自然口播语音。

#### Acceptance Criteria

1. WHEN 用户打开音色选择页 THEN 系统 SHALL 展示可用预置音色和 ready 状态的克隆音色。
2. WHEN 音色不可用 THEN 系统 SHALL 不展示给普通用户。
3. WHEN 用户试听音色 THEN 系统 SHALL 播放该音色样例。

### US-2 TTS 生成

As a 内容运营, I want 把确认后的文案生成语音, so that 后续可以驱动数字人口播。

#### Acceptance Criteria

1. WHEN 用户提交已确认文案和音色 THEN 系统 SHALL 创建 TTS 工作流节点。
2. WHEN TTS 成功 THEN 系统 SHALL 保存音频 artifact。
3. IF 文案超过 3000 字 THEN 系统 SHALL 拒绝生成。
4. IF 本地 TTS provider 超时 THEN 系统 SHALL 标记节点失败并允许重试。
5. IF 未显式启用外部 TTS provider THEN 系统 SHALL NOT 将文案内容发送到线上语音服务。

### US-3 语音参数

As a 内容运营, I want 调整语速、音调和停顿, so that 语音更符合账号风格。

#### Acceptance Criteria

1. WHEN 用户设置语速 THEN 系统 SHALL 在 TTS 请求中保存 speed 参数。
2. WHEN 用户设置音调 THEN 系统 SHALL 在 TTS 请求中保存 pitch 参数。
3. WHEN 用户重新生成语音 THEN 系统 SHALL 创建新的 TTS 节点版本。

### US-4 语音确认

As a 内容运营, I want 试听并确认语音, so that 不满意时可以重新生成。

#### Acceptance Criteria

1. WHEN TTS 成功 THEN 系统 SHALL 将节点置为 waiting_approval。
2. WHEN 用户确认语音 THEN 系统 SHALL 推进到数字人视频生成节点。
3. WHEN 用户重新生成 THEN 系统 SHALL 保留历史音频版本。

## Glossary

| Term | Definition |
| --- | --- |
| TTS | 文本转语音 |
| 预置音色 | 平台内置并已授权使用的声音 |
| 克隆音色 | 用户授权声音样本训练得到的专属声音 |
| provider | TTS 服务提供方，可为商业 API 或自部署模型 |
| 音频 artifact | TTS 输出的 wav/mp3 文件 |
