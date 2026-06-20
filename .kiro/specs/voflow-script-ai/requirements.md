# Requirements: voflow-script-ai

## Introduction

该 Spec 实现口播内容输入、音视频转写、文案结构化、口播化改写、标题生成和基础风险检查。MVP 优先支持粘贴文案和上传音视频转写。文案改写、标题生成和风险提示默认使用本地大模型服务，不依赖线上大模型 API。

## User Stories

### US-1 文案输入

As a 内容运营, I want 粘贴口播文案, so that 我可以快速进入视频生成流程。

#### Acceptance Criteria

1. WHEN 用户粘贴文案 THEN 系统 SHALL 保存 scripts 记录。
2. IF 文案为空 THEN 系统 SHALL 拒绝保存。
3. IF 文案超过 3000 字 THEN 系统 SHALL 提示超出 MVP 限制。

### US-2 音视频转写

As a 内容运营, I want 上传音视频自动转写文案, so that 我可以复用参考内容。

#### Acceptance Criteria

1. WHEN 用户上传 3 分钟以内音视频 THEN 系统 SHALL 创建 ASR 工作流节点。
2. WHEN ASR 成功 THEN 系统 SHALL 保存转写文本和时间戳 segments。
3. IF 音视频超过时长限制 THEN 系统 SHALL 拒绝转写。
4. WHEN ASR 节点执行 THEN 系统 SHALL 从本地模型服务注册表读取 `asr` 服务的 `baseUrl` 和状态，不得重新读取或硬编码 ASR 服务地址。

### US-3 文案改写

As a 内容运营, I want 生成多版口播化改写, so that 我可以选择更适合短视频表达的稿件。

#### Acceptance Criteria

1. WHEN 用户请求改写 THEN 系统 SHALL 调用本地模型服务注册表中的 `llm` 服务。
2. WHEN 用户请求改写 THEN 系统 SHALL 生成 3 到 5 个候选文案。
3. WHEN 候选生成成功 THEN 系统 SHALL 保存模型、提示词参数和版本。
4. IF LLM 服务失败 THEN 系统 SHALL 标记节点失败并允许重试。
5. IF 未显式启用外部模型 provider THEN 系统 SHALL NOT 将文案内容发送到线上大模型服务。

### US-4 标题和风险检查

As a 内容运营, I want 自动生成标题并检查风险, so that 视频发布前有更高点击率和更低合规风险。

#### Acceptance Criteria

1. WHEN 文案确认 THEN 系统 SHALL 通过本地大模型生成不少于 5 个标题候选。
2. WHEN 文案包含敏感词 THEN 系统 SHALL 标记风险并要求人工确认。
3. WHEN 输出风险报告 THEN 系统 SHALL 包含敏感词、版权提示和事实风险提示。

### US-5 本地大模型配置和健康检查复用

As a 开发者, I want 文案 AI 复用统一的本地模型配置和健康状态, so that 平台不会在文案链路中维护第二套 LLM/ASR 配置。

#### Acceptance Criteria

1. WHEN 文案 AI 需要 LLM 配置 THEN 系统 SHALL 从 `local_model_services` 中读取 `llm` 服务的 `baseUrl`、`modelName` 和 `status`。
2. WHEN 文案 AI 需要 ASR 配置 THEN 系统 SHALL 从 `local_model_services` 中读取 `asr` 服务的 `baseUrl` 和 `status`。
3. WHEN 本地模型健康状态需要刷新 THEN 系统 SHALL 复用 `/api/local-model-services/{serviceType}/health` 或同一 health adapter，不得新增重复的 LLM/ASR 健康检查配置。
4. IF 本地 LLM 不可用 THEN 系统 SHALL 将文案改写和标题生成节点标记为失败且可重试。
5. IF 本地 ASR 不可用 THEN 系统 SHALL 将转写节点标记为失败且可重试。
6. IF 未配置线上 provider THEN 系统 SHALL NOT 要求 OpenAI、Claude 或其他线上模型密钥。

## Glossary

| Term | Definition |
| --- | --- |
| ASR | 自动语音识别，把音视频转为文字 |
| 口播化 | 将书面文本改成适合真人口播的表达 |
| 候选文案 | 模型生成的可选文案版本 |
| 风险报告 | 敏感词、版权、事实风险等检查结果 |
| 本地大模型 | 部署在本机或内网服务器的大语言模型服务 |
