# Requirements: voflow-assets-compliance

## Introduction

该 Spec 实现素材上传、对象存储、授权状态和审计日志。自拍数字人、TTS 音频、视频产物、BGM、封面都必须通过统一素材和授权模型管理。

## User Stories

### US-1 素材上传

As a 内容运营, I want 上传图片、音频和视频素材, so that 我可以在视频生成流程中复用这些素材。

#### Acceptance Criteria

1. WHEN 用户上传支持的素材文件 THEN 系统 SHALL 将原始文件保存到对象存储。
2. WHEN 素材保存成功 THEN 系统 SHALL 创建 assets 记录。
3. IF 文件类型不在允许列表 THEN 系统 SHALL 拒绝上传。
4. IF 文件大小超过配置限制 THEN 系统 SHALL 拒绝上传。

### US-2 授权状态

As a 平台运营, I want 每个素材都有授权状态, so that 未授权素材不能进入生成或发布流程。

#### Acceptance Criteria

1. WHEN 素材创建 THEN 系统 SHALL 设置 license_status。
2. IF license_status 不是 approved THEN 系统 SHALL 阻止素材用于生成任务。
3. WHEN 用户确认授权 THEN 系统 SHALL 保存授权文本、用途范围和确认时间。

### US-3 审计日志

As a 企业管理员, I want 查看关键操作审计日志, so that 可以追踪素材和授权相关风险。

#### Acceptance Criteria

1. WHEN 用户上传素材 THEN 系统 SHALL 写入 audit_logs。
2. WHEN 用户确认素材授权 THEN 系统 SHALL 写入 audit_logs。
3. WHEN 用户删除素材 THEN 系统 SHALL 写入 audit_logs。
4. WHEN 查询审计日志 THEN 系统 SHALL 只返回当前 team 范围内记录。

### US-4 统一对象路径

As a 开发者, I want 统一对象存储路径规则, so that 后续 Worker 可以稳定读取输入和写入产物。

#### Acceptance Criteria

1. WHEN 保存素材 THEN 系统 SHALL 使用 `voflow/{teamId}/assets/{assetId}/raw` 路径前缀。
2. WHEN 保存任务产物 THEN 系统 SHALL 使用 `voflow/{teamId}/jobs/{jobId}/{node}/` 路径前缀。
3. WHEN 返回素材信息 THEN 系统 SHALL 返回受控访问 URL 或内部 storage URL。

## Glossary

| Term | Definition |
| --- | --- |
| 素材 | 用户或系统上传的图片、音频、视频、字幕、BGM、封面等文件 |
| 授权状态 | 素材是否允许用于生成、发布或商业用途的状态 |
| 审计日志 | 记录用户关键操作的不可随意修改日志 |
| 对象存储 | MinIO/S3/OSS 等二进制文件存储服务 |
