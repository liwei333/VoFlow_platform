# Tasks: voflow-voice-clone

## Implementation Plan

- [ ] 0. 执行后续开发规范检查
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
