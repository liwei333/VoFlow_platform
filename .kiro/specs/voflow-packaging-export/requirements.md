# Requirements: voflow-packaging-export

## Introduction

该 Spec 实现最终视频包装和导出：字幕、BGM 混音、封面、最终 MP4、下载和端到端 MVP 验收。输入是已确认文案、TTS 音频和数字人口播中间视频。

## User Stories

### US-1 字幕生成

As a 内容运营, I want 自动生成字幕并烧录到视频, so that 短视频在静音播放时也可理解。

#### Acceptance Criteria

1. WHEN 最终文案和音频存在 THEN 系统 SHALL 生成 SRT 或 ASS 字幕。
2. WHEN 字幕生成成功 THEN 系统 SHALL 保存 subtitle artifact。
3. WHEN 最终导出 THEN 系统 SHALL 将字幕硬烧录到 MP4。

### US-2 BGM 混音

As a 内容运营, I want 添加背景音乐并自动降低音量, so that 视频更完整且不遮盖人声。

#### Acceptance Criteria

1. WHEN 用户选择 BGM THEN 系统 SHALL 校验 BGM 授权状态。
2. WHEN 合成音频 THEN 系统 SHALL 保持人声优先。
3. IF BGM 未授权 THEN 系统 SHALL 拒绝合成。

### US-3 封面生成

As a 内容运营, I want 自动生成视频封面, so that 下载成片时有可用封面图。

#### Acceptance Criteria

1. WHEN 最终文案存在 THEN 系统 SHALL 生成封面标题文本。
2. WHEN 数字人视频存在 THEN 系统 SHALL 支持抽帧生成封面。
3. WHEN 封面生成成功 THEN 系统 SHALL 保存 cover artifact。

### US-4 最终导出和下载

As a 内容运营, I want 导出最终 MP4, so that 我可以手动上传到短视频平台。

#### Acceptance Criteria

1. WHEN 数字人视频、音频、字幕和可选 BGM 准备完成 THEN 系统 SHALL 生成最终 MP4。
2. WHEN 最终 MP4 生成成功 THEN 系统 SHALL 保存 final_video artifact。
3. WHEN 用户点击下载 THEN 系统 SHALL 返回受控下载 URL。
4. IF 输出视频黑屏、无音频或文件为空 THEN 系统 SHALL 标记导出失败。

### US-5 端到端 MVP 验收

As a 项目负责人, I want 从照片和文案生成最终视频, so that MVP 可以被真实试用。

#### Acceptance Criteria

1. WHEN 用户上传本人照片、确认文案、选择音色并启动生成 THEN 系统 SHALL 产出 9:16 MP4。
2. WHEN 任务完成 THEN 系统 SHALL 展示每个节点耗时和产物。
3. WHEN 任一节点失败 THEN 系统 SHALL 提供可读错误和重试入口。

## Glossary

| Term | Definition |
| --- | --- |
| final_video | 可下载的最终 MP4 文件 |
| subtitle artifact | SRT/ASS 字幕文件 |
| BGM ducking | 人声出现时自动降低背景音乐音量 |
| cover artifact | 视频封面图片 |
