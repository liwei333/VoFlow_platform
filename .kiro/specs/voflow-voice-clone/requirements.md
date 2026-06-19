# Requirements: voflow-voice-clone

## Introduction

该 Spec 对齐原型中的“我的声音”和创作工作台 Step 4 的声音克隆区。用户上传声音样本，完成授权确认后，本地训练或少样本克隆生成可复用的“我的克隆音色”。

## User Stories

### US-1 上传声音样本

As a 内容运营, I want 上传自己的声音样本, so that 平台可以制作我的克隆音色。

#### Acceptance Criteria

1. WHEN 用户上传音频样本 THEN 系统 SHALL 保存 voice_sample 素材。
2. WHEN 样本上传成功 THEN 系统 SHALL 校验音频时长、格式和清晰度。
3. IF 样本不合格 THEN 系统 SHALL 给出明确原因。

### US-2 声音授权

As a 平台运营, I want 用户确认声音授权, so that 未授权声音不能训练和生成语音。

#### Acceptance Criteria

1. WHEN 用户启动声音克隆前 THEN 系统 SHALL 展示声音授权确认。
2. WHEN 用户确认授权 THEN 系统 SHALL 保存 voice_consents 记录。
3. IF 未确认授权 THEN 系统 SHALL 禁止训练克隆音色。

### US-3 本地训练

As a 内容运营, I want 在本地训练克隆音色, so that 文案不会发送到线上语音服务。

#### Acceptance Criteria

1. WHEN 用户提交合格样本和授权 THEN 系统 SHALL 创建 voice_clone 工作流节点。
2. WHEN 本地训练成功 THEN 系统 SHALL 创建 cloned voice 记录。
3. IF 本地 TTS 训练服务失败 THEN 系统 SHALL 标记节点失败并允许重试。

### US-4 克隆音色管理

As a 内容运营, I want 管理我的克隆音色, so that 我可以试听、重训、删除和复用。

#### Acceptance Criteria

1. WHEN 克隆音色 ready THEN 系统 SHALL 在我的声音页面展示。
2. WHEN 用户试听 THEN 系统 SHALL 播放样例音频。
3. WHEN 用户删除音色 THEN 系统 SHALL 禁止其用于新 TTS 任务。

## Glossary

| Term | Definition |
| --- | --- |
| voice_sample | 用于克隆音色的原始声音素材 |
| voice_consents | 声音授权确认记录 |
| cloned voice | 本地训练生成的用户专属音色 |
