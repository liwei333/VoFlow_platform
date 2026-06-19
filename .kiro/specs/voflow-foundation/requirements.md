# Requirements: voflow-foundation

## Introduction

该 Spec 建立 VoFlow Platform MVP 的基础应用能力：运行环境、账号登录、个人工作台、项目模型、基础权限和健康检查。后续素材、任务、AI Worker、数字人和视频导出都依赖该基础。

## User Stories

### US-1 账号登录

As a 内容运营, I want 登录平台工作台, so that 我可以管理自己的口播视频项目。

#### Acceptance Criteria

1. WHEN 用户提交有效账号凭证 THEN 系统 SHALL 创建登录会话并进入工作台。
2. WHEN 用户未登录访问受保护页面 THEN 系统 SHALL 重定向到登录页。
3. WHEN 用户退出登录 THEN 系统 SHALL 失效当前会话。
4. IF 用户状态为 disabled THEN 系统 SHALL 拒绝登录并返回明确错误码。

### US-2 工作台首页

As a 内容运营, I want 在工作台看到我的项目、最近任务、本地模型状态和导航入口, so that 我可以继续生成口播视频并快速进入各业务模块。

#### Acceptance Criteria

1. WHEN 用户进入工作台 THEN 系统 SHALL 展示用户可访问的项目列表。
2. WHEN 用户无项目 THEN 系统 SHALL 展示创建项目入口。
3. WHEN 用户有运行中任务 THEN 系统 SHALL 展示任务状态摘要。
4. WHEN 用户进入工作台 THEN 系统 SHALL 展示左侧导航：创作工作台、爆款提取、文案库、我的声音、我的数字人、视频任务、发布中心、素材库、本地模型、设置。
5. WHEN 本地模型状态可用 THEN 系统 SHALL 在顶部或首页展示本地模型在线、离线或繁忙状态。

### US-3 项目管理

As a 内容运营, I want 创建 9:16 口播视频项目, so that 后续生成流程可以绑定项目配置。

#### Acceptance Criteria

1. WHEN 用户创建项目 THEN 系统 SHALL 要求项目名称、目标平台、画布比例。
2. WHEN 项目创建成功 THEN 系统 SHALL 保存 owner、team、target_platform、aspect_ratio、status。
3. IF 画布比例不属于 9:16、16:9、1:1 THEN 系统 SHALL 拒绝创建。
4. WHEN 用户查询项目 THEN 系统 SHALL 只返回用户有权限访问的项目。

### US-4 基础运行环境

As a 开发者, I want 一键启动本地 MVP 环境, so that 后续 Spec 可以在统一环境开发和验证。

#### Acceptance Criteria

1. WHEN 开发者执行本地启动命令 THEN 系统 SHALL 启动 Web、API、PostgreSQL、Redis、MinIO。
2. WHEN API 服务启动 THEN 系统 SHALL 提供健康检查接口。
3. WHEN 数据库迁移执行 THEN 系统 SHALL 创建 users、teams、team_members、projects 基础表。
4. WHEN 开发者配置本地模型服务地址 THEN 系统 SHALL 在环境变量中暴露 LLM、TTS、ASR 和数字人服务地址。

## Glossary

| Term | Definition |
| --- | --- |
| 工作台 | 用户登录后的项目和任务入口 |
| 项目 | 一组口播视频生产配置和任务的容器 |
| 团队 | 用户和资源权限归属空间，MVP 可默认创建个人团队 |
| 会话 | 用户登录后的访问凭证 |
| 本地模型服务 | 部署在本机或内网的 LLM、TTS、ASR、数字人推理服务 |
