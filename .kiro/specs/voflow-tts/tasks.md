# Tasks: voflow-tts

## Implementation Plan

- [x] 0. 执行后续开发规范检查
  - 先阅读 `AI_RULES.md`
  - 本 Spec 不得在 Worker、API 或 UI 中散写 TTS 服务地址、音色状态、参数范围、3000 字限制、错误码或音频 artifact 路径
  - TTS 服务 baseUrl、服务状态、状态文案和健康检查必须复用 `voflow-local-model-monitor` 的 `tts` 服务注册表、配置 helper、health adapter 和 API
  - TTS provider、音色 serializer、参数校验、artifact 写入、API 响应必须进入公共 helper/service
  - 若发现同类逻辑已经重复两处以上，先抽公共函数或公共常量，再继续业务实现
  - Checkpoint 反馈必须包含硬编码检查、公共函数提取情况和验证命令
  - _Requirements: US-1, US-2, US-3, US-4_

- [x] 1. 创建音色和 TTS 请求数据库迁移
  - 创建 `voices`
  - 创建 `tts_requests`
  - 添加 voice status、license_status、speed、pitch 校验
  - _Requirements: US-1, US-2, US-3_

- [x] 2. 添加预置音色 seed
  - 添加至少 3 个 MVP 音色
  - 每个音色包含名称、provider、model_id、sample_url
  - 默认 license_status 为 approved
  - _Requirements: US-1_

- [x] 3. 实现音色列表 API
  - 返回 active 且 approved 的预置音色和克隆音色
  - 支持按性别、风格、语言过滤
  - 返回试听样例 URL
  - _Requirements: US-1_

- [x] 4. 定义 TTS Provider Adapter
  - 定义 `synthesize(text, voice, params)`
  - 定义返回音频 buffer/path 和 metadata
  - 实现 mock provider
  - 默认 provider 为本地 TTS 服务
  - _Requirements: US-2_

- [x] 5. 接入本地 TTS provider 配置
  - 从 `local_model_services` 读取 `tts` 服务的 `baseUrl` 和 `status`
  - 不在 TTS 模块重新读取或定义 `TTS_BASE_URL`
  - 处理超时、重试和 provider 错误映射
  - 默认不要求线上 TTS 密钥
  - _Requirements: US-2_

- [x] 6. 实现 TTS 节点创建 API
  - 校验 job、script candidate、voice 权限
  - 支持预置音色和 ready 状态克隆音色
  - 校验文案长度不超过 3000 字
  - 写入 tts_requests
  - 投递 TTS workflow node
  - _Requirements: US-2, US-3_

- [x] 7. 实现 TTS Worker
  - 读取确认文案和音色参数
  - 调用 provider adapter
  - 上传音频到对象存储
  - 写入 audio artifact
  - _Requirements: US-2_

- [x] 8. 实现音频元数据检测
  - 校验音频非空
  - 提取 duration、sample_rate、format
  - 非法输出标记节点失败
  - _Requirements: US-2_

- [x] 9. 实现 TTS 重新生成
  - 支持修改 speed、pitch、pause 参数
  - 创建新节点版本
  - 保留历史音频 artifact
  - _Requirements: US-3, US-4_

- [x] 10. 实现语音确认流程
  - TTS 成功后进入 waiting_approval
  - 用户确认后推进 avatar_render
  - 用户拒绝后允许重新生成
  - _Requirements: US-4_

- [x] 11. 实现音色选择和试听 UI
  - 展示音色卡片
  - 播放试听样例
  - 支持 speed/pitch 参数输入
  - _Requirements: US-1, US-3_

- [x] 12. 实现 TTS 结果 UI
  - 播放生成音频
  - 展示时长和生成参数
  - 提供确认和重新生成按钮
  - _Requirements: US-4_

- [x] 13. 添加测试
  - 音色列表只返回 active approved
  - 文案超长拒绝生成
  - mock provider 成功写入 artifact
  - provider 超时标记节点失败且可重试
  - _Requirements: US-1, US-2, US-3, US-4_

- [x] 14. Checkpoint: TTS 验收
  - 用户可以选择预置音色
  - 用户可以将确认文案生成音频
  - 用户可以试听、确认、重新生成
  - 音频 artifact 可供数字人渲染节点引用
  - _Requirements: US-1, US-2, US-3, US-4_
