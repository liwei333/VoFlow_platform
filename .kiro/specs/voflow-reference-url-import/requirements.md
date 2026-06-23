# Requirements: voflow-reference-url-import

## Introduction

该 Spec 在 `voflow-reference-extract` 的平台识别、上传素材提取、ASR 和结构分析基础上，新增公开参考链接真实导入能力。系统通过可配置的 yt-dlp binary 获取公开链接 metadata、字幕和授权后的音频片段，并严格限制用途为参考分析，避免把外部素材误用为可发布素材、声音克隆素材或数字人素材。

该 Spec 不实现完整视频下载、批量采集、cookie/登录态导入、去水印、评论抓取或发布能力。

## User Stories

### US-1 Metadata 解析

As a 内容运营, I want 粘贴公开参考视频链接后看到标题、平台、时长和封面信息, so that 我可以先判断该链接是否适合作为参考分析来源。

#### Acceptance Criteria

1. WHEN 用户提交受支持的公开参考链接 THEN 系统 SHALL 创建或更新 `ReferenceSource` 并保存 normalized URL、platform、title、durationMs、thumbnailUrl 和 metadataJson。
2. WHEN yt-dlp metadata 解析成功 THEN 系统 SHALL 将 `ReferenceSource.status` 更新为 `metadata_ready`。
3. WHEN 平台不在白名单内 THEN 系统 SHALL 返回可展示的 unsupported 状态并提示用户上传视频/音频或粘贴文案。
4. WHEN yt-dlp 执行超时、输出非法或超过 metadata 大小限制 THEN 系统 SHALL 将失败原因写入 errorJson 并保留上传/粘贴兜底路径。
5. IF `VOFLOW_REFERENCE_LINK_IMPORT_ENABLED` 为 false THEN 系统 SHALL 禁用真实链接导入并保留现有 fallback 行为。

### US-2 字幕优先导入

As a 内容运营, I want 系统优先使用公开链接字幕生成参考文案, so that 无需下载音频和执行 ASR 也能完成爆款结构分析。

#### Acceptance Criteria

1. WHEN metadata 显示存在可用人工字幕或自动字幕 THEN 系统 SHALL 优先选择匹配的字幕轨道并允许用户确认导入。
2. WHEN 用户确认仅用于参考分析 THEN 系统 SHALL 下载字幕、保存字幕产物、清洗字幕文本并创建 `Script` 和 `AsrSegment`。
3. WHEN 字幕导入成功 THEN 系统 SHALL 复用参考结构分析能力生成 hook、rhythm、sellingPoints 和 targetAudience。
4. IF 字幕文件超过大小限制、格式不支持或解析失败 THEN 系统 SHALL 标记字幕导入失败并允许用户选择上传素材或音频提取路径。

### US-3 授权后音频提取

As a 内容运营, I want 在没有可用字幕时授权提取参考音频, so that 系统可以复用本地 ASR 和结构分析能力继续完成参考拆解。

#### Acceptance Criteria

1. WHEN 公开链接没有可用字幕 THEN 系统 SHALL 提示用户确认是否提取音频用于参考分析。
2. WHEN 用户未确认参考分析授权 THEN 系统 SHALL 拒绝 `audio_extract`。
3. WHEN 用户确认授权且链接时长不超过限制 THEN 系统 SHALL 仅提取音频、上传 MinIO、创建 `Asset(type=audio)` 和 `AssetConsent(usageScope=reference_analysis_only)`。
4. WHEN 音频 Asset 创建成功 THEN 系统 SHALL 复用现有 `reference_extract` 工作流执行 ASR 和结构分析。
5. IF 链接时长、音频大小、执行时长或平台白名单校验失败 THEN 系统 SHALL 拒绝提取音频并返回明确错误。

### US-4 合规边界和审计

As a 团队主管, I want 参考链接导入行为有授权记录和审计记录, so that 外部素材不会被误用于发布、声音克隆或数字人生成。

#### Acceptance Criteria

1. WHEN 用户确认导入参考链接 THEN 系统 SHALL 记录 consentTextVersion、importMode、sourceUrl、platform、durationMs、userId 和 teamId。
2. WHEN 系统从公开链接导入字幕、缩略图或音频 THEN 系统 SHALL 默认用途限制为 `reference_analysis_only`。
3. WHEN 业务流程尝试将公开链接导入的音频用于 voice clone、avatar 或 publish THEN 系统 SHALL 阻断并返回授权范围不匹配错误。
4. WHEN 导入成功或失败 THEN 系统 SHALL 写入 `AuditLog`，并包含 importMode、ytDlpVersion、sourceUrl、platform 和失败原因。
5. IF 用户请求完整视频下载、cookie/登录态导入、去水印或批量频道采集 THEN 系统 SHALL 拒绝并提示该能力不在 VoFlow MVP 范围内。

## Non-Functional Requirements

1. WHEN 系统调用 yt-dlp THEN 系统 SHALL 使用 `spawn` 参数数组调用 binary，不得使用 shell 字符串拼接命令。
2. WHEN 系统执行链接导入任务 THEN 系统 SHALL 限制执行超时、stdout/stderr 大小、metadata JSON 大小、字幕大小、音频大小和最大并发。
3. WHEN 系统新增 yt-dlp、平台白名单、时长、大小或开关配置 THEN 系统 SHALL 收口到配置模块和 `.env.example`，不得散写硬编码。
4. WHEN 单元测试和 Worker 测试运行 THEN 系统 SHALL 使用 mock `YtDlpClient`，不得依赖真实外网链接。

## Glossary

| Term | Definition |
| --- | --- |
| yt-dlp | 外部命令行工具，用于公开媒体链接的 metadata、字幕、缩略图和音频提取 |
| metadata_ready | 参考链接 metadata 已解析完成，等待用户选择导入模式 |
| importMode | 参考链接导入模式，包括 `metadata_only`、`subtitle_only`、`audio_extract` |
| reference_analysis_only | 仅允许用于内部参考分析，不允许直接用于生成、声音克隆、数字人或发布 |
| subtitle_only | 优先使用字幕生成 Script 和 AsrSegment 的导入模式 |
| audio_extract | 授权后仅提取音频并复用本地 ASR 的导入模式 |
