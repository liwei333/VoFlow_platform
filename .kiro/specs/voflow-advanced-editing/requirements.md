# Requirements: voflow-advanced-editing

## Introduction

该 Spec 对齐创作工作台 Step 6“视频剪辑”。系统在数字人口播中间视频基础上提供字幕开关、关键词高亮、BGM 自动闪避、画中画、音量控制、转场强度、剪辑预览等能力。

## User Stories

### US-1 字幕样式和关键词高亮

As a 内容运营, I want 控制字幕和关键词高亮, so that 视频更适合短视频观看。

#### Acceptance Criteria

1. WHEN 用户开启字幕 THEN 系统 SHALL 在剪辑预览中展示字幕样式。
2. WHEN 用户开启关键词高亮 THEN 系统 SHALL 标记关键词并输出高亮字幕配置。
3. WHEN 用户保存剪辑配置 THEN 系统 SHALL 保存字幕样式和高亮规则。

### US-2 画中画

As a 内容运营, I want 添加画中画素材, so that 口播视频可以叠加参考画面或产品素材。

#### Acceptance Criteria

1. WHEN 用户开启画中画 THEN 系统 SHALL 要求选择已授权视频或图片素材。
2. WHEN 用户设置位置和大小 THEN 系统 SHALL 保存 picture_in_picture 配置。
3. IF 画中画素材未授权 THEN 系统 SHALL 拒绝保存配置。

### US-3 背景和转场

As a 内容运营, I want 设置背景和转场强度, so that 生成视频更接近原型中的剪辑效果。

#### Acceptance Criteria

1. WHEN 用户选择背景图或背景视频 THEN 系统 SHALL 校验素材授权。
2. WHEN 用户设置转场强度 THEN 系统 SHALL 保存 transition 配置。
3. WHEN 用户点击剪辑预览 THEN 系统 SHALL 生成低成本预览或返回预览配置。

## Glossary

| Term | Definition |
| --- | --- |
| 画中画 | 在主视频上叠加辅助视频或图片素材 |
| 剪辑配置 | 字幕、BGM、画中画、背景、转场等参数集合 |
| 关键词高亮 | 字幕中对重点词进行颜色或样式强调 |
