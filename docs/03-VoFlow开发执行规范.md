# VoFlow 开发执行规范

版本：v0.1
生效范围：从 `voflow-assets-compliance` 当前未完成任务开始，适用于所有后续 Kiro Spec 任务。

## 1. 总原则

1. 先读当前 Spec 的 `requirements.md`、`design.md`、`tasks.md`，再改代码。
2. 只做当前任务要求的最小闭环，不顺手扩大功能范围。
3. 新增能力必须有明确的校验、错误码、测试和验收命令。
4. 后续任务不得绕过已有公共模块；已有公共模块不足时，先补公共模块，再写业务代码。
5. 每个 Checkpoint 前必须说明本次是否新增硬编码、是否抽取公共函数、运行了哪些验证命令。

## 2. 禁止运行时硬编码

以下内容不得直接写死在运行时代码、Worker、API route 或前端业务逻辑中：

1. 服务地址、端口、bucket、模型名、超时时间、重试次数、下载 URL 有效期。
2. 密钥、token、cookie 名称、JWT secret、对象存储账号密码。
3. 平台枚举、素材类型、任务节点类型、状态文案、错误码。
4. 文件大小限制、MIME 白名单、视频比例、发布平台规则。
5. 测试账号密码，除非位于 seed、测试 fixture、README 或 `.env.example`。

允许出现硬编码的文件范围：

1. `.env.example`：仅作为本地开发示例。
2. `docker-compose.yml`：仅作为本地基础设施示例。
3. `prisma/seed.ts`：仅作为开发和测试种子数据。
4. `tests/**`：仅作为测试 fixture，但重复超过两处必须抽 helper。
5. 文档和 Kiro Spec：用于说明默认值和验收条件。

运行时代码必须通过配置模块读取环境变量。生产环境缺少关键密钥时必须 fail fast，不允许使用默认密钥继续运行。

## 3. 配置和常量收口

后续任务涉及配置或枚举时，优先新增或复用以下公共层：

1. `src/lib/config.ts` 或 `src/lib/env.ts`：统一读取和校验环境变量。
2. `src/lib/api-response.ts`：统一 API 成功、错误、Zod 校验失败、分页响应。
3. `src/lib/auth-cookie.ts`：统一 session cookie 名称和 cookie options。
4. `src/lib/platforms.ts`：统一发布平台、平台 label、平台规则和默认平台。
5. `src/lib/workflow/constants.ts`：统一任务节点类型、状态、可重试/需确认规则。
6. `src/lib/assets/validation.ts`：统一素材 MIME 白名单和大小限制。
7. `src/lib/assets/serializer.ts`：统一 asset、artifact 的 JSON 输出和签名 URL 生成。
8. `tests/helpers/**`：统一登录、测试文件、fixture、API_BASE 和清理逻辑。

如果当前任务发现同类逻辑已经在两个以上文件重复，必须优先提取公共函数或公共常量。

## 4. API 规范

1. API 返回结构统一为 `{ code, message?, data?, errors? }`。
2. 成功响应使用 `code: "SUCCESS"`。
3. Zod 校验失败统一返回 `VALIDATION_ERROR` 和结构化 `errors`。
4. 资源不存在、跨 team 访问、软删除资源默认返回 404，避免泄露资源存在性。
5. 所有业务 API 必须使用统一鉴权 helper 校验 session、用户状态和 team 权限。
6. BigInt、Date、枚举映射、签名 URL 不在 route 中散写，必须通过 serializer 输出。
7. route 中只保留编排逻辑；数据库查询、状态机、授权校验、对象存储路径应进入 service/helper。

## 5. 前端规范

1. 页面不得直接散写平台列表、比例 label、状态文案、状态色和导航配置。
2. 页面内重复 fetch、loading、error、空状态逻辑时，应抽 hook 或公共组件。
3. 未实现页面可继续复用 `PlaceholderPage`，但真实页面不能复制占位逻辑。
4. 表单选项必须来自公共常量或 API 返回，不能在多个页面分别维护。
5. 用户可见错误必须来自 API 的明确 `message` 或前端统一错误映射。

## 6. Worker 和对象存储规范

1. Worker payload 必须包含 `jobId`、`nodeId`、`nodeType`、`version`、`traceId`。
2. artifact 路径必须复用 `buildJobArtifactPath(teamId, jobId, node)`。
3. 素材路径必须复用 `buildAssetPath(teamId, assetId)`。
4. Worker 不直接拼对象存储路径、不直接读取 MinIO 环境变量。
5. 可重试节点必须保存错误码、错误详情和版本号，不能覆盖历史产物。

## 7. 测试和验收规范

1. 每个任务先补失败用例，再写实现；无法先写测试时，必须在任务说明里写明原因。
2. 公共函数必须有单元测试。
3. API 必须覆盖未登录、跨 team、校验失败和成功路径。
4. 涉及对象存储、队列、Worker 的任务必须有 mock 或 fixture，不能只依赖人工点击。
5. Checkpoint 至少运行：
   - `npm run lint`
   - 当前任务相关测试，例如 `npm run test:run -- tests/validation.test.ts`
   - 如涉及 API 集成测试，先启动依赖服务和 `npm run dev`，再运行 `API_BASE=http://localhost:3000 npm run test:run -- tests/api.test.ts`
6. 若测试依赖外部服务未启动导致失败，必须在验收记录里写清前置条件和失败原因。

## 8. 后续任务执行记录要求

每个后续任务完成时，必须在执行反馈中包含：

1. 修改文件列表。
2. 是否新增运行时硬编码；如有，说明为什么无法避免。
3. 是否新增公共函数或复用已有公共函数。
4. 运行的验证命令和结果。
5. 未完成风险或需要后续任务继续处理的公共化点。
