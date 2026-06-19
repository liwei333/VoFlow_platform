# Tasks: voflow-self-avatar

## Implementation Plan

- [ ] 0. 执行后续开发规范检查
  - 先阅读 `docs/03-VoFlow开发执行规范.md`
  - 本 Spec 不得在 route、检测器或 UI 中散写图片格式、尺寸阈值、人脸角度阈值、usage scope、状态文案或错误码
  - 照片上传必须复用素材能力；质检阈值、肖像授权、avatar serializer 和 API 响应必须进入公共 helper/service
  - 若发现同类逻辑已经重复两处以上，先抽公共函数或公共常量，再继续业务实现
  - Checkpoint 反馈必须包含硬编码检查、公共函数提取情况和验证命令
  - _Requirements: US-1, US-2, US-3, US-4_

- [ ] 1. 创建数字人数据库迁移
  - 创建 `avatars`
  - 创建 `avatar_consents`
  - 添加 status、license_status 校验
  - 添加 source_asset_id 外键
  - _Requirements: US-3, US-4_

- [ ] 2. 定义照片上传限制
  - 允许 JPG、PNG、WebP
  - 短边推荐不低于 720px
  - 复用 asset upload 能力保存 avatar_source
  - _Requirements: US-1_

- [ ] 3. 实现照片基础元数据解析
  - 获取宽高、mime type、文件大小
  - 计算短边尺寸
  - 写入 asset metadata
  - _Requirements: US-1, US-2_

- [ ] 4. 实现人脸数量检测接口
  - 接入本地人脸检测库或 mock detector
  - 输出 faceCount、faceBox、confidence
  - faceCount 不为 1 时拒绝
  - _Requirements: US-2_

- [ ] 5. 实现人脸角度检测
  - 输出 yaw、pitch、roll
  - 配置阈值
  - 超阈值时写入失败 reason
  - _Requirements: US-2_

- [ ] 6. 实现清晰度检测
  - 使用 Laplacian variance 或检测器置信度
  - 配置 blurScore 阈值
  - 模糊照片给出重新拍摄建议
  - _Requirements: US-2_

- [ ] 7. 实现遮挡和曝光检查
  - MVP 可先做规则化或 mock 输出
  - 标记口罩、墨镜、过暗、过曝
  - 将结果写入 quality_report_json
  - _Requirements: US-2_

- [ ] 8. 实现 `POST /api/avatars/photo-check`
  - 上传照片
  - 创建 avatar_source asset
  - 执行质检
  - 返回 quality_report_json
  - _Requirements: US-1, US-2_

- [ ] 9. 实现肖像授权确认
  - 展示授权文本
  - 保存 avatar_consents
  - usage_scope 包含 avatar_generation 和 video_generation
  - _Requirements: US-3_

- [ ] 10. 实现创建数字人 API
  - 校验 source asset 存在且属于当前 team
  - 校验 quality_report_json.passed
  - 校验授权已确认
  - 创建 avatars ready 记录
  - _Requirements: US-3, US-4_

- [ ] 11. 实现我的数字人列表 API
  - 返回 ready 状态数字人
  - 支持默认排序
  - 不返回 deleted 数字人
  - _Requirements: US-4_

- [ ] 12. 实现数字人软删除 API
  - 设置 status 为 deleted
  - 设置 deleted_at
  - 新任务选择时过滤 deleted
  - _Requirements: US-4_

- [ ] 13. 实现我的数字人 UI
  - 上传/拍照入口
  - 质检结果展示
  - 授权确认
  - 数字人列表、删除、设为默认入口
  - _Requirements: US-1, US-2, US-3, US-4_

- [ ] 14. 添加测试
  - 非图片格式拒绝
  - 多人脸拒绝
  - 未授权不能创建 avatar
  - 删除后列表不返回
  - _Requirements: US-1, US-2, US-3, US-4_

- [ ] 15. Checkpoint: 自拍数字人验收
  - 用户上传本人正脸照片
  - 系统生成质量报告
  - 用户确认肖像授权
  - 我的数字人列表展示可选数字人
  - 不合格照片给出明确原因
  - _Requirements: US-1, US-2, US-3, US-4_
