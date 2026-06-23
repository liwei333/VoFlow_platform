# Tasks: voflow-voice-clone

## Implementation Plan

- [x] 0. 执行后续开发规范检查
  - 先阅读 `docs/03-VoFlow开发执行规范.md`
  - 本 Spec 不得在 Worker、API 或 UI 中散写声音样本格式、质量阈值、训练服务地址、usage scope、状态文案或错误码
  - 声音样本上传必须复用素材能力；授权校验、训练 provider、voice serializer 和 API 响应必须进入公共 helper/service
  - 若发现同类逻辑已经重复两处以上，先抽公共函数或公共常量，再继续业务实现
  - Checkpoint 反馈必须包含硬编码检查、公共函数提取情况和验证命令
  - _Requirements: US-1, US-2, US-3, US-4_

- [ ] 1. 创建声音克隆数据表
  - 创建 `voice_samples`
  - 创建 `voice_consents`
  - 创建 `voice_clone_jobs`
  - _Requirements: US-1, US-2, US-3_

- [ ] 2. 实现声音样本上传
  - 复用 asset upload
  - 限定音频格式
  - 保存 voice_sample metadata
  - _Requirements: US-1_

- [ ] 3. 实现声音质量检测
  - 检查时长
  - 检查音量和静音比例
  - 检查噪声或使用 mock quality report
  - _Requirements: US-1_

- [ ] 4. 实现声音授权确认
  - 展示授权文本
  - 保存 voice_consents
  - usage_scope 包含 voice_clone 和 tts_generation
  - _Requirements: US-2_

- [ ] 5. 实现本地训练任务创建
  - 校验样本合格
  - 校验授权已确认
  - 创建 voice_clone workflow node
  - _Requirements: US-3_

- [ ] 6. 实现本地 Voice Trainer Adapter
  - 支持 GPT-SoVITS/CosyVoice 或 mock trainer
  - 返回 model_id、sample_url、训练日志
  - 失败时写入 error_json
  - _Requirements: US-3_

- [ ] 7. 将训练结果写入 voices
  - 创建 cloned voice 记录
  - status 为 active
  - license_status 为 approved
  - _Requirements: US-3, US-4_

- [ ] 8. 实现我的声音页面
  - 展示预置音色和克隆音色
  - 支持试听、重训、删除
  - 展示授权状态和训练状态
  - _Requirements: US-4_

- [ ] 9. 实现删除/禁用克隆音色
  - 设置 voice status disabled
  - 新 TTS 任务不能选择 disabled 音色
  - 历史任务保留引用
  - _Requirements: US-4_

- [ ] 10. 添加测试
  - 未授权不能训练
  - 样本不合格被拒绝
  - mock trainer 生成 cloned voice
  - disabled voice 不能用于 TTS
  - _Requirements: US-1, US-2, US-3, US-4_

- [ ] 11. Checkpoint: 声音克隆验收
  - 用户上传声音样本并授权
  - 本地训练生成克隆音色
  - 我的声音页面可试听、重训、删除
  - 克隆音色可用于 TTS
  - _Requirements: US-1, US-2, US-3, US-4_

## 执行反馈

### Task 0: 后续开发规范检查与任务执行判断

### 任务
- Spec: `voflow-voice-clone`
- Task: 0
- Requirements: US-1、US-2、US-3、US-4

### 修改文件
- `.kiro/specs/voflow-voice-clone/tasks.md`
- `.kiro/plans/voflow-platform/plan.md`

### 范围说明
- 本次完成：读取并对照 `docs/03-VoFlow开发执行规范.md`，确认 `voflow-voice-clone` 的 `requirements.md`、`design.md`、`tasks.md` 已存在，且当前计划允许从 `voflow-reference-url-import` checkpoint 完成后进入本 Spec。
- 当前任务执行判断：Task 1 是下一个可执行任务，应先创建 `voice_samples`、`voice_consents`、`voice_clone_jobs` 数据表和迁移，再进入上传、质检、授权和训练链路。
- 明确未完成：本轮未创建数据库表、未实现 API、未实现 UI、未实现 trainer adapter。
- 是否使用 mock/provider/adapter 占位：本轮未实现运行时代码；后续 Task 6 如使用 mock trainer，必须在执行反馈中明确标注 mock/provider 边界。

### 规范检查结论
- 配置与硬编码：声音样本格式、质量阈值、训练 provider、训练服务地址、usage scope、状态文案和错误码不得散写到 Worker/API/UI；后续应新增或复用 voice clone 专用常量/config 模块。
- API 规范：后续 `/api/voices/samples`、`/api/voices/samples/{sampleId}/consents`、`/api/voices/clone` 必须复用 `requireAuth`、统一 API response、Zod 校验和 serializer。
- 数据模型：现有 Prisma 已有 `Voice`、`TtsRequest`、`Asset`、`AssetConsent` 和 workflow node；Task 1 只补声音克隆专属 sample/consent/job 模型，避免重复建 voice 主表。
- Worker 规范：`voice_clone` 已存在于 workflow constants；后续 worker payload 必须复用 workflow node/job 结构，错误状态要写入可重试节点。
- 测试规范：Task 1 先补 schema/migration 级测试或 Prisma schema 检查；后续 API 覆盖未登录、跨 team、校验失败、成功路径。

### 硬编码检查
- 是否新增运行时硬编码：否，本轮只更新 Kiro 状态文档。
- 新增配置是否收口：本轮未新增配置；Task 1-3 如新增格式/时长/质量阈值，应收口到 voice clone 配置或常量模块。
- 新增错误码/状态/枚举是否收口：本轮未新增；Task 1 如新增 Prisma enum 或错误码，必须同步 migration、serializer 和测试。

### 公共化检查
- 复用的公共模块：`src/lib/assets/consent.ts`、`src/lib/assets/validation.ts`、`src/lib/tts/serializer.ts`、`src/services/voiceService.ts`、`src/services/ttsService.ts`、`src/lib/workflow/constants.ts`、统一 API response 和 `requireAuth`。
- 新增的公共函数/service：无。
- 后续需要抽取的重复逻辑：声音授权 scope、样本质检阈值、voice clone 错误码和 trainer provider 配置。

### 验证命令
- `rg -n "voice_clone|Voice|AssetConsent|usageScope|WorkflowNodeType" src prisma tests .env.example package.json`: 通过，确认已有 TTS/Voice、资产授权和 workflow 基础能力。
- `git diff --check`: 通过。

### 验收结论
- 是否满足当前 task：满足 Task 0。
- 是否满足对应 Acceptance Criteria：满足启动新 Spec 前的规范检查和任务执行判断；US-1 到 US-4 的业务实现从 Task 1 开始。
- 是否允许勾选：允许勾选 Task 0，不允许勾选 Task 1-11。
- MVP 状态矩阵是否需要同步更新：需要，`voflow-voice-clone` 从 `not_started` 进入 `partial`，下一步为 Task 1 创建声音克隆数据表。
