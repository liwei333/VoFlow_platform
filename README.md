# VoFlow Platform

智能口播视频生成平台的本地开发环境。

## 启动模式

本项目支持两种启动基础设施的方式，**二选一，不要混用**：

---

### 模式 A：Docker Compose（推荐）

需要 Docker Desktop 运行中。

```bash
# 1. 安装依赖
npm install

# 2. 启动基础设施（PostgreSQL + Redis + MinIO）
docker compose up -d

# 3. 验证服务状态
docker compose ps

# 4. 初始化数据库
npm run db:generate
npm run db:migrate
npm run db:seed

# 5. 启动开发服务器
npm run dev
```

---

### 模式 B：Homebrew（不需要 Docker Desktop）

适用于 Docker Desktop 无法运行的环境（如某些网络受限环境）。

```bash
# 1. 安装依赖
npm install

# 2. 检查端口占用
lsof -i :5432   # PostgreSQL
lsof -i :6379   # Redis
lsof -i :9000   # MinIO

# 3. 启动 PostgreSQL 和 Redis
brew services start postgresql
brew services start redis

# 4. 创建数据库用户和表（只需执行一次）
psql -U $(whoami) -d postgres -c "CREATE USER voflow WITH PASSWORD 'voflow123' CREATEDB;"
psql -U $(whoami) -d postgres -c "CREATE DATABASE voflow OWNER voflow;"

# 5. 安装并启动 MinIO
brew install minio
mkdir -p ~/minio-data
MINIO_ROOT_USER=voflow MINIO_ROOT_PASSWORD=voflow123 minio server ~/minio-data --console-address ":9001" &

# 6. 初始化数据库
npm run db:generate
npm run db:migrate
npm run db:seed

# 7. 启动开发服务器
npm run dev
```

> 注意：模式 B 不会自动创建 MinIO bucket（voflow）。首次使用 MinIO Console（http://localhost:9001）登录后手动创建，或使用 mc 命令：
> ```bash
> brew install minio-client
> mc alias set myminio http://localhost:9000 voflow voflow123
> mc mb myminio/voflow
> ```
>
> **安全说明**：Bucket 默认保持私有状态，素材访问通过 presigned URL 或内部 storageUrl 进行，不公开 bucket。

---

## 环境变量

复制 `.env.example` 为 `.env` 并修改配置。

> 注意：`npm run dev` 会自动加载 `.env` 中的环境变量。Docker Compose 模式下，容器内使用容器网络（minio:9000），而 Homebrew 模式下使用 localhost。

## 登录

- 邮箱: dev@voflow.local
- 密码: dev123456
- 禁用账号: disabled@voflow.local / disabled123

## 项目结构

```
src/
  app/              # Next.js App Router
    app/            # 页面
    api/            # API 路由
lib/                # 工具库
prisma/             # 数据库 schema 和 seed
tests/              # Vitest 测试
```
