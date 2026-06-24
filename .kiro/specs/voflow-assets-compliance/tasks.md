# Tasks: voflow-assets-compliance

## Implementation Plan

- [x] 0. 执行后续开发规范检查
  - 先阅读 `AI_RULES.md`
  - 本 Spec 后续实现不得新增运行时硬编码配置、密钥、平台列表、状态文案、错误码、MIME 白名单或大小限制
  - MinIO/S3 配置、对象路径、素材校验、API 响应、审计日志写入必须优先进入公共 helper/service
  - 若发现同类逻辑已经重复两处以上，先抽公共函数或公共常量，再继续业务实现
  - Checkpoint 反馈必须包含硬编码检查、公共函数提取情况和验证命令
  - _Requirements: US-1, US-2, US-3, US-4_

- [x] 1. 创建素材和审计数据库迁移
  - 创建 `assets`、`asset_consents`、`audit_logs`
  - 添加 type、license_status 校验
  - 添加 team_id、owner_id、created_at 索引
  - _Requirements: US-1, US-2, US-3_

- [x] 2. 实现对象存储 Adapter
  - 封装 MinIO/S3 client
  - 实现 `buildAssetPath(teamId, assetId)`
  - 实现 `buildJobArtifactPath(teamId, jobId, node)`
  - _Requirements: US-4_

- [x] 3. 实现文件类型和大小校验
  - 定义允许的 mime type 白名单
  - 定义 image/audio/video 默认大小限制
  - 返回统一校验错误码
  - _Requirements: US-1_

- [x] 4. 实现素材上传 API
  - 接收 multipart 文件
  - 先创建 asset draft 或生成 assetId
  - 上传对象存储成功后写入 assets 记录
  - _Requirements: US-1, US-4_

- [x] 5. 实现素材列表和详情 API
  - 支持按 type、license_status 查询
  - 只返回当前 team 素材
  - 返回可展示的访问 URL
  - _Requirements: US-1, US-2_

- [x] 6. 实现素材软删除 API
  - 设置 deleted_at
  - 删除后默认不出现在素材列表
  - 保留历史任务引用可追溯
  - _Requirements: US-3_

- [x] 7. 实现授权确认 API
  - 实现 `POST /api/assets/{assetId}/consents`
  - 写入 consent_text、usage_scope、ip_address、device_json
  - 将 license_status 更新为 approved
  - _Requirements: US-2_

- [x] 8. 实现授权校验服务
  - 提供 `assertAssetUsable(assetId, usageScope)`
  - 未授权、已拒绝、已过期时抛出业务错误
  - 后续数字人和 TTS 任务必须调用该服务
  - _Requirements: US-2_

- [x] 9. 实现审计日志服务
  - 封装 `writeAuditLog(action, targetType, targetId, metadata)`
  - 上传、授权、删除都写日志
  - 日志写失败时记录应用错误但不伪造成功
  - _Requirements: US-3_

- [x] 10. 实现审计日志查询 API
  - 支持分页
  - 支持 action、target_type、created_at 过滤
  - 限定当前 team 范围
  - _Requirements: US-3_

- [x] 11. 实现素材库 UI
  - 上传入口
  - 素材列表
  - 授权状态标签
  - 删除操作
  - _Requirements: US-1, US-2_

- [x] 12. 实现授权确认 UI
  - 展示授权文本
  - 支持用户勾选确认
  - 成功后刷新素材授权状态
  - _Requirements: US-2_

- [x] 13. 添加测试
  - 上传成功写入对象存储和 assets
  - 非法 mime type 被拒绝
  - 未授权素材调用 `assertAssetUsable` 被拒绝
  - 上传/授权/删除写入审计日志
  - _Requirements: US-1, US-2, US-3, US-4_

- [x] 14. Checkpoint: 素材合规验收
  - 用户可上传图片、音频、视频
  - 用户可确认授权
  - 未授权素材不能被标记为可用
  - 审计日志能查到上传和授权行为
  - _Requirements: US-1, US-2, US-3, US-4_
