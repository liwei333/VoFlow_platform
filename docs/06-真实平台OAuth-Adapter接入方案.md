# VoFlow 真实平台 OAuth/Adapter 接入方案

生成日期：2026-06-26

对应 Spec：`voflow-real-platform-publish`

对应任务：Task 1 - 调研并锁定首个真实平台接入边界

## 1. 结论

首个真实平台锁定为：`youtube_shorts`。

实际接入使用 YouTube Data API v3。VoFlow 内部仍沿用现有 `PublishPlatform.youtube_shorts` 枚举和发布草稿规则，但真实 Adapter 的远端平台名称按 YouTube 处理。YouTube Shorts 不是单独的上传 API；MVP 通过上传符合 Shorts 形态的竖屏短视频到 YouTube，并保存平台返回的 videoId、状态和 URL。

选择原因：

1. 官方 OAuth、上传、状态查询、封面上传、配额和回调规则文档完整。
2. 现有系统已经有 `youtube_shorts` 平台枚举和平台规则，不需要新增平台枚举。
3. `videos.insert` 支持上传视频并设置标题、描述、标签、分类、可见性和部分状态字段。
4. `videos.list` 可用于查询视频资源，支撑发布状态同步。
5. `thumbnails.set` 可用于后续接入封面上传。
6. 首个平台可以用 HTTP mock 完成自动化测试，用真实 YouTube 测试账号完成最终人工复验。

不选择抖音、快手、小红书、视频号或 B 站作为首个平台的原因：这些平台通常存在更强的开放平台审核、应用资质、类目、账号主体、接口白名单或文档访问限制。它们仍保留在后续 Adapter 扩展范围内，但不作为首个 MVP 真实闭环平台。

## 2. 官方依据

本方案只引用官方文档，后续实现前仍需在 Task 2/4/7 开始时重新核对官方文档。

| 能力 | 官方文档 | 本方案使用方式 |
| --- | --- | --- |
| OAuth Web Server Flow | https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps | VoFlow 后端生成授权 URL、处理 callback、换取 access token / refresh token |
| YouTube Data API 认证总览 | https://developers.google.com/youtube/v3/guides/authentication | 确认 YouTube Data API 使用 OAuth 2.0 授权访问用户私有数据 |
| 视频上传 `videos.insert` | https://developers.google.com/youtube/v3/docs/videos/insert | 上传 packaging-export 生成的 `final_video` MP4，并设置标题、描述、标签、可见性 |
| 视频查询 `videos.list` | https://developers.google.com/youtube/v3/docs/videos/list | 按 videoId 查询远端状态和元数据，用于状态同步 |
| 频道查询 `channels.list` | https://developers.google.com/youtube/v3/docs/channels/list | 授权成功后用 `mine=true` 获取当前授权频道 ID 和频道名称 |
| 自定义封面 `thumbnails.set` | https://developers.google.com/youtube/v3/docs/thumbnails/set | 后续支持把 VoFlow cover artifact 设置为 YouTube 缩略图 |
| 视频更新 `videos.update` | https://developers.google.com/youtube/v3/docs/videos/update | 后续如需修改可见性、定时发布或更新元数据时使用 |
| API 修订记录 | https://developers.google.com/youtube/v3/revision_history | 记录配额和 Shorts 统计口径变化，作为接入风险来源 |

## 3. 官方能力确认

### 3.1 OAuth 和授权

YouTube Data API 支持 OAuth 2.0。Web 后端应用需要在 Google Cloud Console 启用 YouTube Data API，创建 Web application OAuth client，并配置 authorized redirect URI。

VoFlow 推荐回调路径：

```text
/api/channel-accounts/youtube_shorts/oauth/callback
```

本地开发回调建议：

```text
http://localhost:3000/api/channel-accounts/youtube_shorts/oauth/callback
```

生产环境必须使用正式域名 HTTPS 回调地址，并在 Google Cloud Console 中登记。

OAuth 参数要求：

1. `response_type=code`
2. `access_type=offline`
3. `include_granted_scopes=true`
4. `state` 必须由 VoFlow 生成，并绑定 userId、teamId、platform、redirect intent 和过期时间。
5. `redirect_uri` 必须与 Google Cloud Console 登记值完全匹配。

token 保存要求：

1. access token 必须加密保存。
2. refresh token 必须加密保存。
3. scope、expiresAt、providerAccountId、providerAccountName、lastAuthorizedAt、lastRefreshAt、lastErrorJson 必须可追溯。
4. authorization code、client secret、access token、refresh token 不得写入日志、API 响应或 UI。

### 3.2 Scope 策略

MVP 建议先申请以下 scope：

```text
https://www.googleapis.com/auth/youtube.upload
https://www.googleapis.com/auth/youtube.readonly
```

使用边界：

1. `youtube.upload` 用于上传视频，并支持 `thumbnails.set` 所需的授权范围之一。
2. `youtube.readonly` 用于读取授权频道和查询发布后视频状态。
3. 暂不默认申请 `youtube.force-ssl`，因为它权限更大；只有当后续必须用 `videos.update` 修改已上传视频、定时发布或扩展编辑能力时，再通过 Spec Change 或 Task 反馈扩大 scope。

### 3.3 频道身份确认

OAuth callback 成功后，应调用：

```text
GET https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,status&mine=true
```

用于获取：

1. YouTube channel id，保存为 `providerAccountId`。
2. channel title，保存为账号昵称。
3. channel status，作为发布中心状态展示依据。

如果返回 0 个频道或接口返回 `channelForbidden` / `channelNotFound`，应把 channel account 标记为不可用，并提示用户检查 YouTube 频道状态。

### 3.4 视频上传

上传接口：

```text
POST https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status
```

请求体包含 video resource，media body 使用 packaging-export 生成的 `final_video` MP4。

VoFlow 字段映射：

| VoFlow 字段 | YouTube 字段 | 说明 |
| --- | --- | --- |
| `publishDraft.title` | `snippet.title` | 必填，沿用现有平台规则校验 |
| `publishDraft.description` | `snippet.description` | 可包含短视频描述 |
| `publishDraft.tagsJson` | `snippet.tags[]` | 空数组不传，避免 API 侧无效参数 |
| 固定默认分类 | `snippet.categoryId` | MVP 默认 `22`，后续可配置 |
| 发布可见性 | `status.privacyStatus` | MVP 默认 `private` 或 `unlisted`，不得默认 public |
| AI 合成声明 | `status.containsSyntheticMedia` | VoFlow 数字人内容默认应设置为 true |
| 定时发布时间 | `status.publishAt` | 仅在后续确认 scope 和平台规则后启用 |

MVP 上传策略：

1. 只上传 `Artifact.type = final_video` 的最终 MP4。
2. 上传前必须校验 artifact 属于当前 team 和 job。
3. 上传前复用 packaging-export 的 ffprobe 验收结果；若缺失，应在发布前检查中提示重新导出或复验。
4. 默认 `notifySubscribers=false`，避免测试发布影响订阅者。
5. 默认可见性优先使用 `private`；如果当前 API 项目已完成审核，可允许配置为 `unlisted`。

### 3.5 未审核 API 项目的限制

官方 `videos.insert` 文档说明：2020-07-28 之后创建的未审核 API 项目，通过 `videos.insert` 上传的视频会被限制为 private。要解除限制，需要完成 API 项目审核。

因此 Task 1 的 MVP 验收锁定为：

1. 最小验收：真实 OAuth 授权成功，真实上传成功，VoFlow 保存 YouTube videoId，平台侧可在授权账号后台查到 private 视频。
2. 增强验收：API 项目已审核或测试账号具备对应能力时，允许上传为 `unlisted`，并保存可访问 URL。
3. 不把 public 发布作为首轮强制验收条件，除非 Google API 项目审核状态已经确认通过。

### 3.6 状态同步

状态查询接口：

```text
GET https://www.googleapis.com/youtube/v3/videos?part=snippet,status,processingDetails,player&id={videoId}
```

同步字段建议：

| YouTube 字段 | VoFlow 字段 | 说明 |
| --- | --- | --- |
| `id` | `publishes.remoteId` | YouTube videoId |
| `status.privacyStatus` | `publishes.remoteStatus.privacyStatus` | private/unlisted/public |
| `status.uploadStatus` | `publishes.remoteStatus.uploadStatus` | uploaded/processed/failed 等远端状态 |
| `processingDetails` | `publishes.remoteStatus.processingDetails` | 处理状态，按权限和 API 返回保存 |
| `player.embedHtml` 或 videoId | `publishes.remoteUrl` | 可构造 `https://www.youtube.com/watch?v={videoId}` |

内部状态映射：

| YouTube 状态 | VoFlow PublishStatus | 说明 |
| --- | --- | --- |
| 上传请求已发起但未返回 videoId | `uploading` | 本地上传中 |
| 返回 videoId，但处理或审核未完成 | `pending` | 等待平台处理 |
| uploadStatus 表示处理完成，且本地查询无错误 | `published` | MVP 可视为平台侧记录已创建 |
| uploadStatus failed/rejected/deleted 或 API 返回不可恢复错误 | `failed` | 保存远端错误 |
| token 失效、权限不足 | `failed` + `CHANNEL_TOKEN_EXPIRED` / `CHANNEL_NOT_CONNECTED` | UI 提示重新授权 |

### 3.7 封面上传

封面接口：

```text
POST https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId={videoId}
```

官方约束包括：

1. 文件最大 2MB。
2. 支持 `image/jpeg`、`image/png`、`application/octet-stream`。
3. 需要授权。
4. 可能因为频道没有自定义缩略图权限而返回 forbidden。

MVP 处理：

1. 封面上传作为增强能力，不阻塞首轮真实上传闭环。
2. 如果 VoFlow cover artifact 存在且文件大小/MIME 满足要求，则上传。
3. 如果封面上传失败但视频上传成功，publish 记录保持 `pending/published`，把封面失败写入 `attemptsJson` 或 `errorJson.warning`，不直接把整次发布标记为 failed。

### 3.8 定时发布和元数据更新

YouTube `videos.insert` 和 `videos.update` 都涉及 `status.publishAt`、`status.privacyStatus` 等字段。官方 `videos.update` 文档说明，设置 `status.publishAt` 时必须满足特定隐私状态条件。

MVP 暂不强制实现真实定时发布，处理策略：

1. VoFlow UI 可保留定时发布字段。
2. YouTube 首轮 Adapter 对 `scheduledAt` 只做参数记录，不向 YouTube 提交定时发布，除非 Task 7 实现前确认 scope 和平台规则。
3. 如果后续要启用 YouTube 定时发布，必须先更新接入方案或 Task 执行反馈，并明确是否需要扩大 scope 到 `youtube.force-ssl`。

## 4. API 和 Adapter 边界

### 4.1 OAuth Provider

建议新增 provider 名称：

```text
youtube
```

内部平台仍为：

```text
youtube_shorts
```

新增或扩展接口：

```ts
interface ChannelOAuthAdapter {
  getAuthorization(input: AuthorizationInput): Promise<AuthorizationUrlResult>;
  exchangeCallback(input: OAuthCallbackInput): Promise<TokenExchangeResult>;
  refreshToken(input: TokenRefreshInput): Promise<TokenRefreshResult>;
  revokeToken?(input: TokenRevokeInput): Promise<void>;
}
```

### 4.2 Channel Adapter

首个真实 Adapter：

```text
src/lib/publish/adapters/youtube.ts
```

建议保持现有 `PublishChannelAdapter` 边界，内部实现：

1. `uploadVideo()`：读取 final_video stream，调用 `videos.insert`。
2. `publish()`：对 YouTube 来说，上传成功即创建平台侧视频记录；保存 videoId/URL/status。
3. `getStatus()`：调用 `videos.list` 查询 videoId。
4. `retry()`：只重试 failed 记录，保留 attempts/history。

Adapter registry 规则：

1. `youtube_shorts` 在真实发布开启时映射到 YouTube adapter。
2. 本地和测试环境可显式允许 mock adapter。
3. 生产真实发布开启时，缺少 YouTube 配置必须 fail fast，不允许静默回退 mock。

## 5. 配置项草案

Task 2 应收口以下配置，不在业务代码散写：

```env
PUBLISH_REAL_ADAPTER_ENABLED=false
PUBLISH_REAL_PROVIDER=youtube
PUBLISH_ALLOW_MOCK_ADAPTER=true

YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REDIRECT_URI=http://localhost:3000/api/channel-accounts/youtube_shorts/oauth/callback
YOUTUBE_API_BASE_URL=https://www.googleapis.com/youtube/v3
YOUTUBE_UPLOAD_BASE_URL=https://www.googleapis.com/upload/youtube/v3
YOUTUBE_OAUTH_AUTH_URL=https://accounts.google.com/o/oauth2/v2/auth
YOUTUBE_OAUTH_TOKEN_URL=https://oauth2.googleapis.com/token
YOUTUBE_DEFAULT_PRIVACY_STATUS=private
YOUTUBE_DEFAULT_CATEGORY_ID=22
YOUTUBE_NOTIFY_SUBSCRIBERS=false
YOUTUBE_UPLOAD_SCOPE=https://www.googleapis.com/auth/youtube.upload
YOUTUBE_READONLY_SCOPE=https://www.googleapis.com/auth/youtube.readonly
```

生产约束：

1. `PUBLISH_REAL_ADAPTER_ENABLED=true` 时，`YOUTUBE_CLIENT_ID`、`YOUTUBE_CLIENT_SECRET`、`YOUTUBE_REDIRECT_URI`、`CHANNEL_TOKEN_ENCRYPTION_SECRET` 必须存在。
2. `PUBLISH_REAL_ADAPTER_ENABLED=true` 且 `PUBLISH_ALLOW_MOCK_ADAPTER=false` 时，任何真实 Adapter 初始化失败都应返回 `PUBLISH_REAL_PLATFORM_NOT_CONFIGURED`。
3. 生产环境不得使用默认 client secret、默认 token secret 或 mock token。

## 6. 数据模型影响

Task 3 需要扩展 `channel_accounts` 和 `publishes`。建议字段如下：

### 6.1 channel_accounts

建议新增：

1. `provider`：`youtube`
2. `providerAccountId`：YouTube channel id
3. `encryptedAccessToken`
4. `encryptedRefreshToken`
5. `tokenType`
6. `scopesJson`
7. `metadataJson`：channel title、thumbnail、raw scope 等脱敏信息
8. `lastAuthorizedAt`
9. `lastRefreshAt`
10. `lastErrorJson`

兼容策略：

1. 现有 mock account 可以继续使用 `encryptedToken`。
2. 真实 YouTube account 必须使用新 token envelope 或明确的加密 JSON envelope。
3. 如果短期不拆字段，必须把 envelope schema 写入测试并保证不泄漏 token。

### 6.2 publishes

建议新增：

1. `remoteUrl`
2. `remoteStatus`
3. `lastSyncedAt`
4. `attemptsJson`

YouTube 字段映射：

1. `remoteId = videoId`
2. `requestId = upload attempt id` 或 Google request id
3. `remoteUrl = https://www.youtube.com/watch?v={videoId}`
4. `remoteStatus = status + processingDetails + privacyStatus` 的脱敏 JSON

## 7. 错误码映射

| 场景 | VoFlow 错误码 | 处理 |
| --- | --- | --- |
| 真实发布开启但缺少配置 | `PUBLISH_REAL_PLATFORM_NOT_CONFIGURED` | fail fast，不回退 mock |
| OAuth state 不匹配或过期 | `CHANNEL_OAUTH_STATE_INVALID` | 拒绝 callback |
| code 换 token 失败 | `CHANNEL_OAUTH_EXCHANGE_FAILED` | 账号保持未连接或上次状态 |
| access token 过期且 refresh 失败 | `CHANNEL_TOKEN_REFRESH_FAILED` | 标记 expired/revoked |
| 无 channel 或权限不足 | `CHANNEL_NOT_CONNECTED` | UI 提示重新授权 |
| final_video 不存在或不属于 team/job | `PUBLISH_FINAL_VIDEO_NOT_FOUND` | 阻断上传 |
| YouTube 上传失败 | `PUBLISH_UPLOAD_FAILED` | 保存 attempts/history |
| YouTube 返回限流或配额不足 | `PUBLISH_RATE_LIMITED` | 可重试但需退避 |
| 项目未审核导致只能 private | `PUBLISH_PLATFORM_REVIEW_REQUIRED` | 不视为上传失败，但验收只能按 private 记录 |
| 状态查询失败 | `PUBLISH_STATUS_SYNC_FAILED` | 保留上次状态并记录同步错误 |

## 8. MVP 验收边界

### 8.1 本任务锁定的验收目标

Task 1 锁定的首轮真实平台 MVP 验收为：

```text
VoFlow final_video -> YouTube OAuth 授权账号 -> videos.insert 上传 -> 返回 videoId -> VoFlow 保存 remoteId/remoteUrl/remoteStatus -> videos.list 可同步状态 -> 发布中心可展示真实平台记录
```

### 8.2 首轮不强制验收

以下能力不作为首轮 Task 7/12 必须完成条件，除非后续任务显式扩展：

1. public 公开视频发布。
2. YouTube 定时发布。
3. 修改已上传视频元数据。
4. 上传封面成功。
5. 多 YouTube channel 代理发布。
6. YouTube Partner / CMS `onBehalfOfContentOwner`。
7. 抖音、快手、小红书、视频号、B 站、TikTok 真实 Adapter。

### 8.3 通过条件

首轮真实接入完成时，至少满足：

1. OAuth 授权成功，数据库保存加密 token 和 YouTube channel id。
2. 使用 packaging-export 的真实 `final_video` artifact 上传到 YouTube。
3. YouTube 返回 videoId。
4. 本地 `publishes` 保存 remoteId、remoteUrl、remoteStatus、lastSyncedAt。
5. `videos.list` 能按 videoId 查询到平台侧记录。
6. 发布中心展示 YouTube 账号状态、发布状态、远端 URL 或 private 视频说明。
7. token/secret/code 不出现在日志、API 响应、UI 或未加密字段。

## 9. 前置条件和阻塞项

执行 Task 2 之前需要准备：

1. Google Cloud project。
2. 已启用 YouTube Data API v3。
3. Web application OAuth client。
4. 已登记本地和生产 redirect URI。
5. 可授权的 YouTube 测试账号和频道。
6. 测试账号允许上传视频。
7. 明确 API project 是否已完成审核；如果未完成审核，验收默认按 private 视频处理。
8. 可用的 `CHANNEL_TOKEN_ENCRYPTION_SECRET`。
9. 可生成 final_video 的 VoFlow 测试 job。

阻塞项：

1. 如果 Google Cloud project 无法启用 YouTube Data API，则 Task 4/7 无法真实联调。
2. 如果 OAuth app 未完成必要验证，测试账号可能看到未验证应用提示；这不阻塞开发，但必须记录。
3. 如果 API project 未通过 YouTube API Services 审核，公开视频发布不能作为首轮验收目标。
4. 如果测试频道无自定义缩略图权限，封面上传只能记录 warning，不阻塞视频上传验收。

## 10. 后续任务映射

| 后续任务 | 本方案给出的执行边界 |
| --- | --- |
| Task 2 | 新增 YouTube 配置读取、fail-fast 和 `.env.example` |
| Task 3 | 扩展 channel account token envelope 和 publish remote fields |
| Task 4 | 实现 YouTube OAuth authorize/callback/code exchange |
| Task 5 | 实现 refresh token、重新授权和脱敏错误 |
| Task 6 | 实现 final_video resolver 和 adapter registry |
| Task 7 | 实现 YouTube adapter 的 upload/publish/getStatus/retry |
| Task 8 | 实现 videos.list 状态同步和 retry attempts |
| Task 9 | 发布中心展示 YouTube 真实账号、remoteUrl、remoteStatus 和 private 限制 |
| Task 10 | 用 HTTP mock 覆盖 OAuth、upload、status、rate limit、token refresh 和脱敏 |
| Task 11 | 用真实或准生产环境跑 YouTube private/unlisted 上传复验 |
| Task 12 | 以 YouTube 首轮真实闭环作为 checkpoint 证据 |

## 11. 本任务结论

`voflow-real-platform-publish` Task 1 可以标记为完成。

下一步进入：

```text
voflow-real-platform-publish Task 2: 实现真实发布配置和 fail-fast 校验
```

Task 2 不应先写 YouTube OAuth 或 Adapter，而应先建立集中配置读取、环境变量校验、mock fallback 禁止规则和 `.env.example` 示例。
