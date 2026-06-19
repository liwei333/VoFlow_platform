# Requirements: voflow-reference-extract

## Introduction

该 Spec 对齐原型中的“爆款提取”和创作工作台 Step 1。用户可以粘贴爆款视频链接、上传视频/音频或导入素材，系统提取原始文案、来源平台、视频时长、转写时间，并分析钩子、节奏和卖点。

## User Stories

### US-1 链接导入

As a 内容运营, I want 粘贴爆款视频链接, so that 系统可以提取参考文案和结构。

#### Acceptance Criteria

1. WHEN 用户提交链接 THEN 系统 SHALL 识别来源平台。
2. WHEN 平台解析成功 THEN 系统 SHALL 保存 reference_source 记录。
3. IF 链接解析失败 THEN 系统 SHALL 提示用户改用上传视频或粘贴文案。

### US-2 上传参考视频音频

As a 内容运营, I want 上传参考视频或音频, so that 链接不可解析时仍可提取文案。

#### Acceptance Criteria

1. WHEN 用户上传视频或音频 THEN 系统 SHALL 校验素材授权和时长。
2. WHEN 校验通过 THEN 系统 SHALL 创建 reference_extract 工作流节点。
3. IF 时长超过限制 THEN 系统 SHALL 拒绝提取。

### US-3 结构分析

As a 内容运营, I want 提取钩子、节奏和卖点, so that 后续改写能复刻爆款结构。

#### Acceptance Criteria

1. WHEN 转写成功 THEN 系统 SHALL 生成原始文案。
2. WHEN 结构分析成功 THEN 系统 SHALL 输出钩子、分段节奏、核心卖点和目标受众。
3. WHEN 分析结果保存 THEN 系统 SHALL 绑定项目和素材来源。

## Glossary

| Term | Definition |
| --- | --- |
| 爆款链接 | 抖音、快手、小红书等平台的视频参考链接 |
| reference_source | 参考内容来源记录 |
| 钩子 | 短视频开头吸引注意力的表达结构 |
| 节奏 | 文案或视频的信息推进结构 |
