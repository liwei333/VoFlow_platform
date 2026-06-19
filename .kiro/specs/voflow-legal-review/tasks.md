# Tasks: voflow-legal-review

## Implementation Plan

- [ ] 0. 执行后续开发规范检查
  - 先阅读 `docs/03-VoFlow开发执行规范.md`
  - 本 Spec 不得在 route、Worker 或 UI 中散写风险类型、严重级别、处理动作、风险词库、错误码或状态文案
  - 风险规则、LLM 法务解释 provider、审计日志写入、TTS 前阻断校验和 API 响应必须进入公共 helper/service
  - 若发现同类逻辑已经重复两处以上，先抽公共函数或公共常量，再继续业务实现
  - Checkpoint 反馈必须包含硬编码检查、公共函数提取情况和验证命令
  - _Requirements: US-1, US-2, US-3_

- [ ] 1. 创建法务审查数据表
  - 创建 `legal_reviews`
  - 创建 `legal_risk_items`
  - 添加 risk_type、severity、action 校验
  - _Requirements: US-1, US-2, US-3_

- [ ] 2. 建立 MVP 风险词库
  - 违禁词
  - 敏感词
  - 夸大宣传表达
  - 平台规则风险词
  - _Requirements: US-1_

- [ ] 3. 实现规则风险扫描
  - 扫描文案并定位原句
  - 输出 risk_type、severity、original_text
  - 统计各风险类型数量
  - _Requirements: US-1_

- [ ] 4. 实现本地 LLM 法务解释
  - 输入风险项和上下文
  - 输出风险原因和替换建议
  - LLM 失败时保留规则扫描结果
  - _Requirements: US-1, US-2_

- [ ] 5. 实现创建审查 API
  - 绑定 script_candidate
  - 保存 summary_json
  - 高风险时设置 waiting_approval
  - _Requirements: US-1_

- [ ] 6. 实现一键替换 API
  - 将全部可替换风险项应用到文案
  - 保存 resolved_script
  - 将风险项 action 置为 replaced
  - _Requirements: US-2_

- [ ] 7. 实现逐条处理 API
  - 支持 replaced、ignored、confirmed_safe
  - ignored 必须填写原因
  - 写入审计日志
  - _Requirements: US-2, US-3_

- [ ] 8. 实现 TTS 前阻断校验
  - 高风险 pending 时阻断进入 TTS
  - 返回 `LEGAL_HIGH_RISK_UNRESOLVED`
  - 通过后输出最终合规文案
  - _Requirements: US-3_

- [ ] 9. 实现 AI 法务审查 UI
  - 展示六类风险统计卡片
  - 展示原句、风险原因、建议替换
  - 支持一键替换、逐条确认、忽略并记录
  - _Requirements: US-1, US-2, US-3_

- [ ] 10. 添加测试
  - 敏感词命中生成风险项
  - 一键替换生成 resolved_script
  - 忽略风险无原因被拒绝
  - 高风险未处理阻断 TTS
  - _Requirements: US-1, US-2, US-3_

- [ ] 11. Checkpoint: AI 法务审查验收
  - 候选文案可生成审查报告
  - 风险项可替换、确认、忽略
  - 未处理高风险不能进入声音生成
  - _Requirements: US-1, US-2, US-3_
