# Requirements: voflow-video-render

## Introduction

该 Spec 使用已确认 TTS 音频驱动用户数字人或预置数字人生成口播视频。该 Spec 只产出数字人口播中间视频，最终字幕、BGM、封面和导出由 `voflow-packaging-export` 处理。

## User Stories

### US-1 选择数字人生成视频

As a 内容运营, I want 选择我的数字人和音频生成口播视频, so that 我可以得到真人形象口播画面。

#### Acceptance Criteria

1. WHEN 用户选择 ready 数字人和 approved TTS 音频 THEN 系统 SHALL 创建 avatar_render 节点。
2. IF 数字人状态不是 ready THEN 系统 SHALL 拒绝生成。
3. IF 音频 artifact 不存在 THEN 系统 SHALL 拒绝生成。

### US-2 快速预览

As a 内容运营, I want 先生成低清预览, so that 我可以在高清渲染前确认口型和画面。

#### Acceptance Criteria

1. WHEN 用户请求预览 THEN 系统 SHALL 使用 preview 模式生成低清视频。
2. WHEN 预览成功 THEN 系统 SHALL 保存 avatar_video artifact。
3. WHEN 预览成功 THEN 系统 SHALL 将节点置为 waiting_approval。

### US-3 高清渲染

As a 内容运营, I want 确认预览后生成高清视频, so that 最终导出质量可用。

#### Acceptance Criteria

1. WHEN 用户确认预览 THEN 系统 SHALL 创建高清渲染任务。
2. WHEN 高清渲染成功 THEN 系统 SHALL 保存高清 avatar_video artifact。
3. IF GPU Worker 失败 THEN 系统 SHALL 标记节点失败并允许重试。

### US-4 渲染参数

As a 内容运营, I want 设置画面比例和人物裁剪, so that 数字人适配不同短视频版式。

#### Acceptance Criteria

1. WHEN 用户创建渲染任务 THEN 系统 SHALL 保存 aspectRatio。
2. WHEN 用户选择半身或头像裁剪 THEN 系统 SHALL 保存 crop 参数。
3. IF aspectRatio 不属于项目支持比例 THEN 系统 SHALL 拒绝生成。

## Glossary

| Term | Definition |
| --- | --- |
| avatar_render | 音频驱动数字人生成口播视频的工作流节点 |
| preview | 低清快速预览 |
| hd | 高清渲染 |
| avatar_video | 数字人口播中间视频产物 |
