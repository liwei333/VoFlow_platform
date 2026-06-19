# Tasks: voflow-publish-assistant

## Implementation Plan

- [ ] 0. 执行后续开发规范检查
  - 先阅读 `docs/03-VoFlow开发执行规范.md`
  - 本 Spec 不得在 API、Adapter 或 UI 中散写平台规则、标题长度、标签数量、token 状态、错误码、发布状态文案或重试策略
  - 平台规则、Channel Adapter、发布草稿 serializer、token 加密、参数检查和 API 响应必须进入公共 helper/service
  - 若发现同类逻辑已经重复两处以上，先抽公共函数或公共常量，再继续业务实现
  - Checkpoint 反馈必须包含硬编码检查、公共函数提取情况和验证命令
  - _Requirements: US-1, US-2, US-3, US-4_

- [ ] 1. 创建发布相关数据表
  - 创建 `channel_accounts`
  - 创建 `publish_drafts`
  - 创建 `publishes`
  - 添加 platform 和 status 校验
  - _Requirements: US-1, US-2, US-4_

- [ ] 2. 实现平台规则配置
  - 配置标题长度
  - 配置标签数量
  - 配置封面比例
  - 配置视频时长限制
  - _Requirements: US-1, US-3_

- [ ] 3. 实现发布信息生成
  - 调用本地 LLM 生成标题、描述、标签、话题
  - 按平台生成独立草稿
  - 保存 publish_drafts
  - _Requirements: US-1_

- [ ] 4. 实现发布草稿编辑 API
  - 查询草稿
  - 修改标题、描述、标签、话题、封面
  - 保存平台独立草稿
  - _Requirements: US-1_

- [ ] 5. 实现渠道账号模型和状态展示
  - 支持 connected、expired、not_connected
  - 返回账号昵称和过期时间
  - token 加密存储
  - _Requirements: US-2_

- [ ] 6. 实现 OAuth/授权占位接口
  - MVP 可先使用 mock channel account
  - 真实平台接入保留 adapter
  - token 过期时展示重新授权入口
  - _Requirements: US-2_

- [ ] 7. 实现发布参数检查
  - 校验视频比例、标题长度、标签数量、封面尺寸
  - 校验 channel account 状态
  - 保存 validation_json
  - _Requirements: US-3_

- [ ] 8. 实现 Channel Adapter 接口
  - `uploadVideo`
  - `publish`
  - `getStatus`
  - `retry`
  - 实现 mock adapter
  - _Requirements: US-4_

- [ ] 9. 实现一键发布 API
  - 只对检查通过且 connected 的平台创建发布任务
  - expired 或 not_connected 平台标记 skipped
  - 保存 request_id 和平台结果
  - _Requirements: US-4_

- [ ] 10. 实现失败重试 API
  - 只允许 failed 状态重试
  - 只重试单个平台
  - 保存新 request_id 和错误历史
  - _Requirements: US-4_

- [ ] 11. 实现封面与发布信息 UI
  - 平台 tabs
  - 标题、标签、描述、话题编辑
  - 标题限制、标签数量、封面比例提示
  - _Requirements: US-1, US-3_

- [ ] 12. 实现发布中心 UI
  - 展示账号授权状态
  - 展示发布参数检查
  - 支持定时发布、保存草稿、仅导出 MP4、一键发布
  - 展示发布日志
  - _Requirements: US-2, US-3, US-4_

- [ ] 13. 添加测试
  - 平台草稿生成
  - 标题超长阻断发布
  - token 过期平台 skipped
  - 部分平台失败后可单独重试
  - _Requirements: US-1, US-2, US-3, US-4_

- [ ] 14. Checkpoint: 发布辅助验收
  - 最终视频生成后可生成平台草稿
  - 授权状态和参数检查可见
  - 一键发布支持部分成功、失败原因和重试
  - _Requirements: US-1, US-2, US-3, US-4_
