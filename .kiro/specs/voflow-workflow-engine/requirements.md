# Requirements: voflow-workflow-engine

## Introduction

该 Spec 实现异步任务中心和工作流节点状态机。所有 AI 生成步骤必须通过该引擎进入队列、记录状态、保存产物、支持失败重试和人工确认。

## User Stories

### US-1 创建视频任务

As a 内容运营, I want 创建单视频生成任务, so that 平台可以按节点生成口播视频。

#### Acceptance Criteria

1. WHEN 用户提交视频任务 THEN 系统 SHALL 创建 video_jobs 记录。
2. WHEN 任务创建成功 THEN 系统 SHALL 初始化 workflow_nodes。
3. IF 项目不存在或无权限 THEN 系统 SHALL 拒绝创建任务。

### US-2 查看任务进度

As a 内容运营, I want 查看每个节点的状态, so that 我知道视频生成卡在哪一步。

#### Acceptance Criteria

1. WHEN 用户打开任务详情 THEN 系统 SHALL 返回任务状态、当前节点、进度和节点列表。
2. WHEN 节点状态变化 THEN 系统 SHALL 更新 video_jobs.current_node 和 progress。
3. WHEN 节点失败 THEN 系统 SHALL 展示 error_code、error_message 和 retryable。

### US-3 节点重试

As a 内容运营, I want 重试失败节点, so that 我不需要重新创建整条视频任务。

#### Acceptance Criteria

1. WHEN 用户重试失败节点 THEN 系统 SHALL 创建该节点的新执行版本。
2. WHEN 节点重试 THEN 系统 SHALL 只重跑该节点和下游节点。
3. IF 节点错误不可重试 THEN 系统 SHALL 禁止重试并返回原因。

### US-4 人工确认

As a 内容运营, I want 在文案、语音和视频节点人工确认, so that 最终视频质量可控。

#### Acceptance Criteria

1. WHEN 节点需要人工确认 THEN 系统 SHALL 将节点状态设置为 `waiting_approval`。
2. WHEN 用户确认节点 THEN 系统 SHALL 将节点状态设置为 `approved` 并推进下游节点。
3. WHEN 用户要求重新生成 THEN 系统 SHALL 创建新节点执行版本。

## Glossary

| Term | Definition |
| --- | --- |
| video_job | 一次单视频生成任务 |
| workflow_node | 视频任务中的一个可执行步骤 |
| artifact | 节点输出的文件或结构化结果 |
| retryable | 失败是否允许用户或系统重试 |
