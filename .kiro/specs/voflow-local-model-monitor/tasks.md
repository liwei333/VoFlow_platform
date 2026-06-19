# Tasks: voflow-local-model-monitor

## Implementation Plan

- [ ] 0. 执行后续开发规范检查
  - 先阅读 `docs/03-VoFlow开发执行规范.md`
  - 本 Spec 不得在 health API、页面或 Worker 中散写模型服务地址、模型名、超时时间、状态文案或 FFmpeg 命令路径
  - LLM/ASR/TTS/AVATAR/FFMPEG 配置读取必须收口到公共配置模块和服务注册表
  - 若发现同类逻辑已经重复两处以上，先抽公共函数或公共常量，再继续业务实现
  - Checkpoint 反馈必须包含硬编码检查、公共函数提取情况和验证命令
  - _Requirements: US-1, US-2, US-3_

- [ ] 1. 创建本地模型服务数据表
  - 创建 `local_model_services`
  - 添加 service_type、status 校验
  - 写入默认服务类型 seed
  - _Requirements: US-1, US-3_

- [ ] 2. 实现环境变量加载
  - 读取 LLM/ASR/TTS/AVATAR/FFMPEG 配置
  - 缺失配置标记为 misconfigured
  - 写入或更新服务注册表
  - _Requirements: US-3_

- [ ] 3. 实现服务健康检查 Adapter
  - LLM 检查 `/v1/models` 或 chat completion 最小请求
  - ASR/TTS/Avatar 检查服务 health endpoint
  - FFmpeg 检查本地命令和版本
  - _Requirements: US-2_

- [ ] 4. 实现服务状态 API
  - 返回服务地址、模型名称、状态、延迟、资源占用
  - 返回最近错误
  - 支持前端轮询
  - _Requirements: US-1_

- [ ] 5. 实现单服务健康检查 API
  - 调用对应 Adapter
  - 保存 latency_ms、status、checked_at
  - 失败写入 last_error_json
  - _Requirements: US-2_

- [ ] 6. 实现全部健康检查 API
  - 并发检查全部服务
  - 返回聚合状态
  - 单个服务失败不影响其他服务结果
  - _Requirements: US-2_

- [ ] 7. 实现本地模型页面
  - 展示 LLM、ASR、TTS、数字人、FFmpeg 卡片
  - 展示环境变量示例
  - 支持单服务和全部健康检查按钮
  - _Requirements: US-1, US-2, US-3_

- [ ] 8. 添加测试
  - 缺失环境变量显示 misconfigured
  - 模拟服务在线返回 online
  - 模拟超时写入错误状态
  - 全部健康检查部分失败仍返回完整结果
  - _Requirements: US-1, US-2, US-3_

- [ ] 9. Checkpoint: 本地模型监控验收
  - 页面展示五类本地服务
  - 健康检查可更新状态和延迟
  - 环境变量示例与 `.env.example` 一致
  - _Requirements: US-1, US-2, US-3_
