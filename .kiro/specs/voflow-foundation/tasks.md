# Tasks: voflow-foundation

## Implementation Plan

- [x] 1. 初始化应用工程和基础目录
  - 创建 Web、API、packages/shared 或等价目录结构
  - 添加 `.env.example`，包含数据库、Redis、MinIO、会话密钥配置
  - 在 `.env.example` 中预留 `LLM_BASE_URL`、`LLM_MODEL`、`TTS_BASE_URL`、`ASR_BASE_URL`、`AVATAR_BASE_URL`
  - 添加本地 README 启动说明
  - _Requirements: US-4_

- [x] 2. 配置本地 Docker Compose
  - 配置 PostgreSQL、Redis、MinIO 服务
  - 预留本地 LLM/TTS/ASR/Avatar 服务的外部地址配置
  - 配置持久化 volume 和默认 bucket 初始化方式
  - 添加健康检查命令
  - _Requirements: US-4_

- [x] 3. 建立数据库迁移框架
  - 选择 Prisma/Drizzle/Alembic/SQL migrations 中一种
  - 创建 users、teams、team_members、projects 表
  - 添加枚举或 check constraint 校验 status、role、aspect_ratio
  - _Requirements: US-3, US-4_

- [x] 4. 实现用户模型和种子数据
  - 添加本地开发用户 seed
  - 默认创建个人 team 和 owner member
  - 确保 disabled 用户可用于登录失败测试
  - _Requirements: US-1, US-4_

- [x] 5. 实现登录 API
  - 实现 `POST /api/auth/login`
  - 校验账号密码和用户状态
  - 创建安全会话 cookie 或 bearer token
  - _Requirements: US-1_

- [x] 6. 实现退出和当前用户 API
  - 实现 `POST /api/auth/logout`
  - 实现 `GET /api/me`
  - 添加未登录 401 行为
  - _Requirements: US-1_

- [x] 7. 实现认证中间件
  - 保护 `/api/projects` 等业务 API
  - 将 userId、teamId 注入请求上下文
  - 添加 disabled 用户二次校验
  - _Requirements: US-1, US-3_

- [x] 8. 实现项目创建 API
  - 实现 `POST /api/projects`
  - 校验 name、targetPlatform、aspectRatio
  - 写入 owner_id、team_id、status
  - _Requirements: US-3_

- [x] 9. 实现项目列表 API
  - 实现 `GET /api/projects`
  - 只返回当前用户所属 team 的项目
  - 按更新时间倒序
  - _Requirements: US-2, US-3_

- [x] 10. 实现健康检查 API
  - 实现 `GET /api/health`
  - 检查 API、PostgreSQL、Redis、MinIO
  - 依赖异常时返回 503 和 dependency 明细
  - _Requirements: US-4_

- [x] 11. 实现登录页
  - 创建账号、密码输入和提交状态
  - 展示登录失败错误
  - 登录成功跳转工作台
  - _Requirements: US-1_

- [x] 12. 实现工作台首页
  - 展示项目列表
  - 无项目时展示创建项目入口
  - 预留最近任务摘要区域
  - 展示运行中任务、失败任务、本地模型状态摘要
  - _Requirements: US-2_

- [x] 13. 实现主导航和页面壳
  - 左侧导航包含创作工作台、爆款提取、文案库、我的声音、我的数字人、视频任务、发布中心、素材库、本地模型、设置
  - 顶部包含搜索框、模式切换、本地模型状态
  - 未实现页面先使用业务占位页
  - _Requirements: US-2_

- [x] 14. 实现项目创建 UI
  - 支持项目名称、目标平台、画布比例
  - 画布比例限定 9:16、16:9、1:1
  - 创建成功后进入项目详情或创作页
  - _Requirements: US-3_

- [x] 15. 添加基础测试
  - 测试登录成功、密码错误、disabled 用户拒绝
  - 测试未登录访问项目 API 返回 401
  - 测试项目比例非法时返回校验错误
  - _Requirements: US-1, US-3, US-4_

- [ ] 16. Checkpoint: 平台底座验收
  - 本地启动命令可运行
  - 开发用户可以登录、创建项目、查看项目列表
  - 左侧导航和 Dashboard 与原型页面结构一致
  - 健康检查能展示 DB/Redis/MinIO 状态
  - _Requirements: US-1, US-2, US-3, US-4_

## 返修完成项

- [x] R1. 服务端鉴权中间件
  - Next.js middleware 保护 /dashboard/* 页面
  - 未登录访问受保护页面服务端 302 重定向到 /login
  - 保留 /api/* 的 401 行为

- [x] R2. 统一认证/授权 helper
  - 抽取 `src/lib/api-auth.ts` 的 `requireAuth()` 函数
  - 校验 session JWT 有效性
  - 校验用户存在且 status !== disabled
  - 校验 session.teamId 对应 team_members 权限仍存在

- [x] R3. 项目比例 API 契约修正
  - 外部请求/响应使用 "9:16"、"16:9"、"1:1"
  - API 层做 Prisma 枚举映射 (`src/lib/aspect-ratio.ts`)
  - 前端项目创建 UI 提交字面值

- [ ] R4. Prisma migration 初始化
  - `npm run db:migrate` 生成初始迁移
  - README 更新使用 migrate 命令

- [x] R5. Docker Compose MinIO bucket 初始化
  - 增加 minio-init 服务等待 MinIO ready
  - 使用 mc 命令创建 MINIO_BUCKET=voflow

- [x] R6. 本地模型状态显示修复
  - API/health 返回 llm/tts/asr/avatar 配置状态
  - 前端根据真实结果展示 online/offline/unknown
  - 未配置时显示"未配置/未知"，不显示假阳性就绪

- [x] R7. ESLint 非交互配置
  - 配置 `next/core-web-vitals` + `next/typescript`
  - `npm run lint` 无交互式提示直接通过

- [x] R8. 测试修复
  - `npm run test:run` 在文档定义前置条件下可稳定通过
  - 覆盖登录成功、密码错误、disabled 拒绝、未登录 401
  - 覆盖非法比例拒绝、合法比例创建、按 team 过滤查询
  - Health API 返回 dependencies 和 models 明细
