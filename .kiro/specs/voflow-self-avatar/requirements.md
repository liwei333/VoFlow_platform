# Requirements: voflow-self-avatar

## Introduction

该 Spec 实现用户拍照或上传本人照片创建“我的数字人”。系统必须完成照片质量检测、肖像授权确认、数字人资产创建、预览和后续复用。

## User Stories

### US-1 上传本人照片

As a 内容运营, I want 拍照或上传本人照片, so that 我可以制作专属 AI 数字人。

#### Acceptance Criteria

1. WHEN 用户上传 JPG、PNG 或 WebP 图片 THEN 系统 SHALL 创建 avatar_source 素材。
2. IF 图片格式不支持 THEN 系统 SHALL 拒绝上传。
3. IF 图片短边低于 720px THEN 系统 SHALL 标记质量不通过。

### US-2 照片质量检测

As a 内容运营, I want 系统检测照片是否适合制作数字人, so that 生成结果更稳定。

#### Acceptance Criteria

1. WHEN 照片上传完成 THEN 系统 SHALL 检测人脸数量。
2. IF 人脸数量不是 1 THEN 系统 SHALL 拒绝创建数字人。
3. WHEN 系统检测人脸角度、清晰度、遮挡和曝光 THEN 系统 SHALL 保存 quality_report_json。
4. IF 任一必需质量项不通过 THEN 系统 SHALL 给出可读原因。

### US-3 肖像授权确认

As a 平台运营, I want 用户确认肖像授权, so that 未授权形象不能进入数字人生成。

#### Acceptance Criteria

1. WHEN 用户创建数字人前 THEN 系统 SHALL 展示肖像授权确认。
2. WHEN 用户确认授权 THEN 系统 SHALL 创建 avatar_consents 记录。
3. IF 用户未确认授权 THEN 系统 SHALL 禁止创建数字人资产。

### US-4 我的数字人资产

As a 内容运营, I want 在我的数字人列表管理数字人, so that 后续口播视频可以复用。

#### Acceptance Criteria

1. WHEN 质量检测和授权均通过 THEN 系统 SHALL 创建 avatars 记录。
2. WHEN 数字人创建成功 THEN 系统 SHALL 展示在我的数字人列表。
3. WHEN 用户删除数字人 THEN 系统 SHALL 禁止该数字人用于新任务。
4. WHEN 查询数字人列表 THEN 系统 SHALL 只返回当前 team 可访问数字人。

## Glossary

| Term | Definition |
| --- | --- |
| 我的数字人 | 用户上传本人照片后创建的可复用数字人资产 |
| avatar_source | 用于创建数字人的原始照片素材 |
| quality_report_json | 照片质检结果，包括人脸、角度、清晰度、遮挡、曝光 |
| avatar_consents | 肖像授权确认记录 |
