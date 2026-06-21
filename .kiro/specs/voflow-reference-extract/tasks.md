# Tasks: voflow-reference-extract

## Implementation Plan

- [x] 0. 执行后续开发规范检查
  - 先阅读 `docs/03-VoFlow开发执行规范.md`
  - 本 Spec 不得在页面、API 或 Worker 中散写平台域名列表、解析错误码、ASR 服务地址、时长限制或素材类型限制
  - 平台识别、素材授权校验、ASR provider、workflow node 创建和 API 响应必须复用公共模块
  - 若发现同类逻辑已经重复两处以上，先抽公共函数或公共常量，再继续业务实现
  - Checkpoint 反馈必须包含硬编码检查、公共函数提取情况和验证命令
  - _Requirements: US-1, US-2, US-3_

- [x] 1. 创建参考来源数据表
  - 创建 `reference_sources`
  - 保存 platform、source_url、asset_id、structure_json
  - 添加 project_id 和 team_id 索引
  - _Requirements: US-1, US-2, US-3_

- [x] 2. 实现平台链接识别
  - 识别抖音、快手、小红书、视频号、B站、YouTube、TikTok 域名
  - 不支持平台返回明确错误
  - 保留平台扩展 Adapter
  - _Requirements: US-1_

- [x] 3. 实现链接解析 Adapter
  - MVP 可先支持可下载公开链接或 mock 解析
  - 解析失败时保留 source_url 和失败原因
  - 提示用户上传视频/音频兜底
  - _Requirements: US-1_

- [x] 4. 实现上传素材提取入口
  - 校验素材类型为 video/audio
  - 校验素材授权
  - 校验时长限制
  - _Requirements: US-2_

- [x] 5. 接入 ASR 转写节点
  - 创建 reference_extract 工作流节点
  - 调用 faster-whisper
  - 保存原文和 segments
  - _Requirements: US-2, US-3_

- [x] 6. 实现爆款结构分析 Worker
  - 调用本地 LLM
  - 提取钩子、节奏、卖点、目标受众
  - 写入 structure_json
  - _Requirements: US-3_

- [x] 7. 实现爆款提取 UI
  - 链接输入
  - 上传视频/音频
  - 导入素材
  - 展示来源平台、视频时长、转写时间、原始文案
  - _Requirements: US-1, US-2, US-3_

- [x] 8. 添加测试
  - 支持平台识别
  - 不支持平台拒绝
  - 链接失败可切换上传
  - 结构分析结果保存
  - _Requirements: US-1, US-2, US-3_

- [x] 9. Checkpoint: 爆款提取验收
  - 用户可以提交链接或上传文件
  - 系统生成原文、平台、时长、结构分析
  - 失败时给出上传兜底路径
  - _Requirements: US-1, US-2, US-3_
