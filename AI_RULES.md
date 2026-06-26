# AI_RULES.md - VoFlow 开发执行规范

版本：v0.1
生效范围：适用于 VoFlow Platform 后续所有 Kiro Spec、返修项、Checkpoint 验收和开发执行反馈。实际开发入口以 `.kiro/plans/voflow-platform/plan.md` 的当前开发游标、各 `.kiro/specs/*/tasks.md` 的勾选状态为准；不得根据本文中的历史示例推断当前任务。AI 工具在执行任何开发任务前，必须先读取本文件，再按“下一任务启动检查”读取 plan 和当前 Spec 文档。

## 1. 总原则

1. 先按“下一任务启动检查”读取 `AI_RULES.md`、总控 plan、当前 Spec 的 `requirements.md`、`design.md`、`tasks.md`，再改代码。
2. 只做当前任务要求的最小闭环，不顺手扩大功能范围。
3. 新增能力必须有明确的校验、错误码、测试和验收命令。
4. 后续任务不得绕过已有公共模块；已有公共模块不足时，先补公共模块，再写业务代码。
5. 每个 Checkpoint 前必须说明本次是否新增硬编码、是否抽取公共函数、运行了哪些验证命令。

## 2. CodeGraph 使用规范

CodeGraph 是 AI 工具理解代码结构、符号关系和影响面的辅助索引，不是任务来源、业务验收依据或测试替代。

1. 启动 Kiro Spec、返修项或共享模块改动前，必须先读取 `.kiro/plans/voflow-platform/plan.md` 和当前 `.kiro/specs/*/tasks.md`，确认任务边界后再使用 CodeGraph 定位代码。
2. 涉及 TypeScript/TSX 代码、API route、service、lib、worker、serializer、UI 公共函数或测试文件时，应优先用 CodeGraph 查找相关 symbol、调用方、被调用方和影响面，再决定实际文件范围。
3. 修改共享函数、公共 service、领域 lib、状态机、serializer、鉴权、发布平台 adapter 或 workflow 相关逻辑前，必须先通过 CodeGraph 或等价结构化检索确认 callers/callees/impact，避免只修局部。
4. CodeGraph 只用于缩小阅读范围；实际修改前仍必须直接读取目标文件，确认当前内容、未提交改动和任务上下文。
5. 刚修改过的文件若 CodeGraph 提示索引滞后、pending sync 或结果与文件内容不一致，必须以直接读取文件为准。
6. CodeGraph 不能替代验证。完成后仍必须运行当前任务相关测试、lint、build 或 API 验收命令。
7. `.codegraph/**` 中的数据库、日志、pid、sock、wal、shm 等运行态文件是本机缓存，不得作为项目事实来源，不得提交为业务代码或 Spec 证据。

## 3. 禁止运行时硬编码

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

存量代码中若已有环境变量默认值或散落配置，除非当前任务直接触达该模块或该问题阻塞验收，不得借题扩大重构。当前任务触达相关模块时，必须按以下顺序处理：先补配置读取或校验测试，再迁移调用方，再记录验证命令。生产关键密钥不得继续新增默认值。

## 4. 配置和常量收口

后续任务涉及配置或枚举时，优先复用已有领域模块；若不存在，再新增清晰命名的公共层。

已有公共层：

1. `src/lib/api-response.ts`：统一 API 成功、错误、Zod 校验失败、分页响应。
2. `src/lib/api-auth.ts` / `src/lib/auth.ts`：统一 API 鉴权、session token、用户状态和 team membership 校验。
3. `src/lib/workflow/constants.ts`、`src/lib/workflow/errors.ts`、`src/lib/workflow/status.ts`：统一 workflow 节点、状态、错误口径。
4. `src/lib/assets/validation.ts`、`src/lib/assets/serializer.ts`、`src/lib/assets/ui.ts`：统一素材校验、输出和 UI 展示口径。
5. `src/lib/local-model/config.ts`：统一本地模型服务配置。
6. 各领域 `constants.ts` / `ui.ts` / `serializer.ts`：如 `tts`、`voice-clone`、`avatar`、`avatar-render`、`legal-review`、`references`。

建议补齐：

1. `src/lib/config.ts` 或领域 `config.ts`：新增环境变量必须集中读取和校验。
2. `tests/helpers/**`：后续触达大量重复 login、fixture、mock、API_BASE 逻辑时再抽取。
3. 发布平台规则模块：进入 `voflow-publish-assistant` 时，再按实际边界创建 `src/lib/publish/*` 或等价领域模块，不能提前写死在页面。

如果当前任务发现同类逻辑已经在两个以上文件重复，必须优先提取公共函数或公共常量。

## 5. API 规范

1. API 返回结构统一为 `{ code, message?, data?, errors? }`。
2. 成功响应使用 `code: "SUCCESS"`。
3. Zod 校验失败统一返回 `VALIDATION_ERROR` 和结构化 `errors`。
4. 资源不存在、跨 team 访问、软删除资源默认返回 404，避免泄露资源存在性。
5. 所有业务 API 必须使用统一鉴权 helper 校验 session、用户状态和 team 权限。
6. BigInt、Date、枚举映射、签名 URL 不在 route 中散写，必须通过 serializer 输出。
7. route 中只保留编排逻辑；数据库查询、状态机、授权校验、对象存储路径应进入 service/helper。
8. route 不直接暴露 service、provider、Worker 或底层依赖的异常文本；领域错误必须映射为稳定的 `code`、`message` 和 HTTP status。

## 6. 前端规范

1. 页面不得直接散写平台列表、比例 label、状态文案、状态色和导航配置。
2. 页面内重复 fetch、loading、error、空状态逻辑时，应抽 hook 或公共组件。
3. 未实现页面可继续复用 `PlaceholderPage`，但真实页面不能复制占位逻辑。
4. 表单选项必须来自公共常量或 API 返回，不能在多个页面分别维护。
5. 用户可见错误必须来自 API 的明确 `message` 或前端统一错误映射。
6. 领域展示文案、状态色、状态 label 和格式化函数优先收口到对应 `src/lib/<domain>/ui.ts`；业务枚举和阈值优先收口到对应 `constants.ts`。

## 7. Worker 和对象存储规范

1. 队列入口 Worker payload 必须包含 `jobId`、`nodeId`、`nodeType`、`version`、`traceId`；内部 service/helper 可以传更窄 DTO，但必须能追溯到 `traceId`、`jobId` 和 `nodeId`。
2. artifact 路径必须复用 `buildJobArtifactPath(teamId, jobId, node)`。
3. 素材路径必须复用 `buildAssetPath(teamId, assetId)`。
4. Worker 不直接拼对象存储路径、不直接读取 MinIO 环境变量。
5. 可重试节点必须保存错误码、错误详情和版本号，不能覆盖历史产物。

## 8. 测试和验收规范

1. 每个任务先补失败用例，再写实现；无法先写测试时，必须在任务说明里写明原因。
2. 公共函数必须有单元测试。
3. API 必须覆盖未登录、跨 team、校验失败和成功路径。
4. 涉及对象存储、队列、Worker 的任务必须有 mock 或 fixture，不能只依赖人工点击。
5. Checkpoint 至少运行：
   - `npm run lint`
   - 当前任务相关测试，例如 `npm run test:run -- tests/validation.test.ts`
   - 如涉及 API 集成测试，先启动依赖服务和 `npm run dev`，再运行 `API_BASE=http://localhost:3000 npm run test:run -- tests/api.test.ts`
6. 若测试依赖外部服务未启动导致失败，必须在验收记录里写清前置条件和失败原因。
7. 涉及类型、route、Next 页面、Prisma client 或跨模块改动时，必须运行 `npx tsc --noEmit` 或 `npm run build`。
8. 修改 `prisma/schema.prisma` 或 migrations 时，必须运行 `npm run db:generate`，并记录数据库同步命令；本地非交互环境不要把 `prisma migrate dev` 作为默认自动化验收命令。

## 9. 后续任务执行记录要求

每个后续任务完成时，必须在执行反馈中包含：

1. 修改文件列表。
2. 是否新增运行时硬编码；如有，说明为什么无法避免。
3. 是否新增公共函数或复用已有公共函数。
4. 运行的验证命令和结果。
5. 开始前已有未提交改动、本任务实际改动、未触碰的既有改动。
6. 是否更新 `tasks.md`、`plan.md` 或新增 Change Log / 返修项。
7. 未完成风险或需要后续任务继续处理的公共化点。
8. 若任务涉及代码修改，说明是否使用 CodeGraph 或等价结构化检索确认相关文件和影响面；如未使用，说明原因。

## 10. Spec 变更规则

后续任务出现以下情况时，必须先更新对应 Spec 文档，再改代码：

1. 原任务要求真实模型、真实平台或真实 Worker，但当前只能实现 mock、provider、adapter 或占位接口。
2. 原任务要求端到端闭环，但当前只完成中间 artifact、配置、接口或 UI 壳。
3. 任务边界、验收口径或 MVP 状态发生变化。
4. 任务实现边界超出原设计，从单层实现扩展到 API、Worker、数据库、对象存储、UI 或本地模型服务等多层联动。
5. 验收命令、测试范围或外部依赖发生实质变化，且会影响后续任务判断。
6. 某个任务不能按原计划完成，需要拆分成“抽象/占位”和“真实接入”两个阶段。

以下情况在原 Spec 边界内时，可在执行反馈中记录，不必先改 Spec：

1. 新增具体错误码、状态枚举、Provider 类型、平台规则、素材类型或任务节点类型，且 `requirements.md` / `design.md` 已包含对应能力边界。
2. 新增内部 service/helper、serializer 字段、测试 helper 或 UI 格式化函数。
3. focused tests 的文件名或命令细节调整，但验收目标不变。

Spec 变更记录必须写入对应 `tasks.md` 的 “Change Log” 或 “返修项” 章节，格式如下：

```md
### Change: yyyy-mm-dd - 标题

- 原要求：
- 调整后：
- 原因：
- 影响的 requirements：
- 影响的 tasks：
- 新增验收命令：
- 后续未完成项：
```

若变更会影响 MVP 主线状态，必须同步更新 `.kiro/plans/voflow-platform/plan.md` 的状态矩阵。

## 11. Checkpoint 完成定义

每个 Spec 的 Checkpoint 只有同时满足以下条件，才能标记为完成：

1. `requirements.md` 中每条 Acceptance Criteria 都能映射到自动化测试、代码实现、验收记录或明确的未完成说明。
2. `design.md` 中声明的组件边界已落到实际 service/helper/component/worker，或在 `tasks.md` 中注明延期原因。
3. `tasks.md` 中每个已勾选任务都有对应实现、测试或明确验收证据。
4. 新增 API 覆盖未登录、跨 team、校验失败和成功路径；若某项不适用，必须说明原因。
5. 新增 Worker、对象存储、队列、模型调用必须有 mock、fixture 或本地替代验证，不能只依赖人工点击。
6. 不新增未经收口的运行时硬编码；新增配置必须进入配置模块或明确的常量模块。
7. `npm run lint` 通过。
8. 当前 Spec 相关测试通过。
9. 若全量测试因外部依赖失败，必须记录失败命令、外部依赖、错误摘要和复验条件。
10. 如果使用 mock/provider/adapter 占位，必须在 `tasks.md` 中标明真实能力尚未完成，不能按真实能力验收。

## 12. 统一执行反馈模板

每个任务完成时，执行反馈必须使用以下结构；缺失关键项时不得勾选 Checkpoint：

```md
## 执行反馈

### 任务
- Spec:
- Task:
- Requirements:

### 修改文件
- ...

### 范围说明
- 本次完成：
- 明确未完成：
- 是否使用 mock/provider/adapter 占位：

### 工作区状态
- 开始前已有未提交改动：
- 本任务实际改动：
- 未触碰的既有改动：

### 硬编码检查
- 是否新增运行时硬编码：
- 新增配置是否收口：
- 新增错误码/状态/枚举是否收口：

### 公共化检查
- 复用的公共模块：
- 新增的公共函数/service：
- 后续需要抽取的重复逻辑：

### CodeGraph 检查
- 是否使用 CodeGraph 或等价结构化检索：
- 确认的入口/调用链/影响面：
- 未使用原因：

### 验证命令
- `npm run lint`:
- `npm run test:run -- ...`:
- 其他命令：

### 验收结论
- 是否满足当前 task：
- 是否满足对应 Acceptance Criteria：
- 是否允许勾选：
- MVP 状态矩阵是否需要同步更新：

### 文档同步
- 是否更新 `tasks.md`：
- 是否更新 `plan.md`：
- 是否新增 Change Log / 返修项：
```

## 13. 下一任务启动检查

启动任一新任务前，必须先完成以下检查：

1. 读取 `AI_RULES.md`。
2. 读取 `.kiro/plans/voflow-platform/plan.md`，确认当前唯一开发入口和依赖顺序。
3. 读取当前 Spec 的 `requirements.md`、`design.md`、`tasks.md`。
4. 运行 `git status --short`，确认哪些是本任务相关改动，哪些只需保留不碰。
5. 若任务涉及代码修改，用 CodeGraph 或等价结构化检索确认相关入口、调用链、影响面和测试范围。
6. 明确本次只处理一个 task 或一个返修项；若需要扩大范围，先更新 Spec Change。
7. 写出当前 task 的文件范围和验收命令；没有验收命令不得开始实现。
