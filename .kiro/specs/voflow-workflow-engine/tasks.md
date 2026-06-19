# Tasks: voflow-workflow-engine

## Implementation Plan

- [ ] 0. 执行后续开发规范检查
  - 先阅读 `docs/03-VoFlow开发执行规范.md`
  - 本 Spec 不得新增运行时硬编码配置、任务节点类型、状态文案、错误码、重试次数或队列 payload 字段
  - 任务节点枚举、状态机、队列 payload、artifact serializer、API 响应必须优先进入公共 helper/service
  - 若发现同类逻辑已经重复两处以上，先抽公共函数或公共常量，再继续业务实现
  - Checkpoint 反馈必须包含硬编码检查、公共函数提取情况和验证命令
  - _Requirements: US-1, US-2, US-3, US-4_

- [ ] 1. 创建任务相关数据库迁移
  - 创建 `video_jobs`、`workflow_nodes`、`artifacts`
  - 添加 status、progress、version 校验
  - 添加 project_id、team_id、job_id 索引
  - _Requirements: US-1, US-2_

- [ ] 2. 定义工作流节点枚举和默认模板
  - 定义原型对齐节点顺序：reference_extract、script_rewrite、legal_review、voice_clone、tts、avatar_render、editing_preview、final_export、publish
  - 标记哪些节点需要人工确认
  - 标记哪些节点可重试
  - _Requirements: US-1, US-4_

- [ ] 3. 实现任务创建服务
  - 校验项目权限
  - 创建 video_job
  - 批量创建 workflow_nodes
  - 投递第一个节点到队列
  - _Requirements: US-1_

- [ ] 4. 实现队列 Adapter
  - 封装 enqueue、retry、cancel 基础方法
  - 统一 job payload：jobId、nodeId、nodeType、version、traceId
  - 处理队列投递失败
  - _Requirements: US-1, US-3_

- [ ] 5. 实现节点状态流转服务
  - pending -> queued
  - queued -> running
  - running -> succeeded/failed
  - succeeded -> waiting_approval/approved
  - _Requirements: US-2, US-4_

- [ ] 6. 实现任务进度计算
  - 按节点权重计算 progress
  - 更新 current_node
  - 节点失败时同步 job error
  - _Requirements: US-2_

- [ ] 7. 实现任务详情 API
  - 返回任务基础信息
  - 返回节点列表和每个节点最新版本
  - 返回 artifacts 摘要
  - _Requirements: US-2_

- [ ] 8. 实现任务列表 API
  - 支持按项目查询
  - 支持按状态过滤
  - 只返回当前 team 范围内任务
  - _Requirements: US-2_

- [ ] 9. 实现节点重试 API
  - 校验节点失败且 retryable
  - 复制输入并创建新版本
  - 将该节点及下游节点置为 pending
  - _Requirements: US-3_

- [ ] 10. 实现节点确认 API
  - 校验节点状态为 waiting_approval
  - 写入 approved 状态和确认人
  - 推进下一个节点
  - _Requirements: US-4_

- [ ] 11. 实现任务取消 API
  - 未完成节点置为 cancelled
  - 尝试取消队列任务
  - 已完成产物保留
  - _Requirements: US-2_

- [ ] 12. 实现 Worker 执行框架
  - 拉取节点 payload
  - 调用 node handler
  - 捕获异常并写 error_json
  - 支持 mock handler 便于前端联调
  - _Requirements: US-1, US-2_

- [ ] 13. 实现 artifacts 写入服务
  - 保存 artifact type、storage_url、metadata_json
  - 绑定 job_id 和 node_id
  - 保证同一节点多版本产物可追溯
  - _Requirements: US-2, US-3_

- [ ] 14. 实现任务中心 UI
  - 展示任务列表
  - 展示节点进度条
  - 展示失败原因和重试按钮
  - 展示等待确认按钮
  - _Requirements: US-2, US-3, US-4_

- [ ] 15. 添加状态机单元测试
  - 测试合法状态流转
  - 测试非法状态流转被拒绝
  - 测试失败节点重试版本递增
  - _Requirements: US-2, US-3, US-4_

- [ ] 16. Checkpoint: 工作流验收
  - 创建视频任务后生成默认节点
  - mock Worker 能推进任务到 waiting_approval
  - 失败节点可重试且保留旧版本
  - 任务中心能展示进度
  - 任务中心能展示法务审查、声音克隆、发布等原型中出现的节点状态
  - _Requirements: US-1, US-2, US-3, US-4_
