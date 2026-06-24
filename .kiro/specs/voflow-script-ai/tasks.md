# Tasks: voflow-script-ai

## Implementation Plan

- [x] 0. 执行后续开发规范检查
  - 先阅读 `AI_RULES.md`
  - 本 Spec 不得在 Worker、API 或页面中散写 LLM 地址、模型名、prompt 参数、字数限制、错误码、敏感词或外部模型开关
  - LLM/ASR 的 baseUrl、modelName、服务状态、状态文案和健康检查必须复用 `voflow-local-model-monitor` 的服务注册表、配置 helper、health adapter 和 API
  - LLM provider、prompt 模板、风险词库、ASR segments serializer、API 响应必须进入公共 helper/service
  - 默认配置不得调用线上大模型；外部 provider 必须显式配置并有测试覆盖
  - 若发现同类逻辑已经重复两处以上，先抽公共函数或公共常量，再继续业务实现
  - Checkpoint 反馈必须包含硬编码检查、公共函数提取情况和验证命令
  - _Requirements: US-1, US-2, US-3, US-4, US-5_

- [x] 1. 创建文案数据库迁移
  - 创建 `scripts`、`script_candidates`、`asr_segments`
  - 添加 project_id、job_id、script_id 索引
  - 定义 source_type 和 status 校验
  - _Requirements: US-1, US-2, US-3_

- [x] 2. 实现文案保存 API
  - 校验项目权限
  - 校验非空和 3000 字限制
  - 写入 scripts 版本 1
  - _Requirements: US-1_

- [x] 3. 实现音视频转写任务创建 API
  - 校验素材授权和类型
  - 校验 3 分钟以内
  - 创建 ASR workflow node input
  - _Requirements: US-2_

- [x] 4. 接入 ASR Worker handler
  - 从对象存储下载音视频
  - 从本地模型服务注册表读取 `asr` 服务配置
  - 调用注册表中的 ASR 服务或 mock provider
  - 输出文本和 segments
  - _Requirements: US-2_

- [x] 5. 保存 ASR 转写结果
  - 写入 scripts
  - 写入 asr_segments
  - 将结果作为节点 output_json
  - _Requirements: US-2_

- [x] 6. 定义 LLM Provider 接口
  - `rewriteScript(input, options)`
  - `generateTitles(script, platform)`
  - `healthCheck()`
  - 默认 provider 为 local OpenAI-compatible
  - provider 只消费 `llm` 服务的 `baseUrl`、`modelName` 和业务生成参数，不直接读取 `LLM_BASE_URL`/`LLM_MODEL`
  - _Requirements: US-3, US-4, US-5_

- [x] 7. 接入本地模型服务注册表
  - 从 `local_model_services` 读取 `llm` 服务的 `baseUrl`、`modelName`、`status`
  - 从 `local_model_services` 读取 `asr` 服务的 `baseUrl`、`status`
  - 仅在文案 AI 模块读取 `LLM_PROVIDER`、`LLM_MAX_TOKENS` 等业务生成参数，不重复定义模型地址、模型名、超时和状态文案
  - _Requirements: US-5_

- [x] 8. 复用本地模型健康状态
  - 不新增 `GET /api/llm/health`
  - 调用 `voflow-local-model-monitor` 的 health adapter 或 `/api/local-model-services/{serviceType}/health`
  - 将 `llm` 不可用映射为 `LOCAL_LLM_UNAVAILABLE`
  - 将 `asr` 不可用映射为 `LOCAL_ASR_UNAVAILABLE`
  - _Requirements: US-5_

- [x] 9. 设计口播改写 Prompt 模板
  - 输入原文、平台、时长、语气、禁用词
  - 输出 3-5 个候选
  - 要求口播自然、结构清晰、避免照搬
  - _Requirements: US-3_

- [x] 10. 实现文案改写 Worker
  - 调用本地 LLM Provider
  - 解析候选结果
  - 保存 model_name、prompt_json、version
  - 本地 LLM 失败时标记节点可重试
  - _Requirements: US-3, US-5_

- [x] 11. 实现标题生成 Worker
  - 生成不少于 5 个标题
  - 保存到 title_candidates_json
  - 支持目标平台参数
  - 使用本地 LLM Provider
  - _Requirements: US-4, US-5_

- [x] 12. 实现风险检查服务
  - 配置 MVP 敏感词词表
  - 输出 risk_report_json
  - 风险命中时设置 waiting_approval
  - _Requirements: US-4_

- [x] 13. 实现外部模型调用保护
  - 默认配置下禁用 external provider
  - 只有显式设置 `ALLOW_EXTERNAL_LLM=true` 才允许外部 provider
  - 添加测试确保默认不会读取 OpenAI/Claude 密钥
  - _Requirements: US-3, US-5_

- [x] 14. 实现候选文案确认 API
  - 标记 candidate approved
  - 将 approved candidate 绑定到 video_job
  - 风险命中时要求用户确认
  - _Requirements: US-3, US-4_

- [x] 15. 实现文案编辑 UI
  - 粘贴文案
  - 展示字数和预计时长
  - 展示候选文案、标题和风险提示
  - _Requirements: US-1, US-3, US-4_

- [x] 16. 实现音视频转写 UI
  - 选择已上传音视频素材
  - 创建转写任务
  - 展示转写文本和 segments 摘要
  - _Requirements: US-2_

- [x] 17. 添加测试
  - 文案为空和超长校验
  - ASR 超时长拒绝
  - 本地 LLM mock 生成候选并保存
  - 本地 LLM 不可用时节点失败且可重试
  - 默认配置不调用线上大模型
  - 敏感词命中产生风险报告
  - _Requirements: US-1, US-2, US-3, US-4, US-5_

- [x] 18. Checkpoint: 文案 AI 验收
  - 用户可以粘贴文案并生成 3-5 个候选
  - 用户可以上传短音视频并获得转写文本
  - 标题候选和风险报告可见
  - 默认通过本地大模型完成文案和标题生成
  - 断开本地 LLM 时文案节点失败并允许重试
  - _Requirements: US-1, US-2, US-3, US-4, US-5_
