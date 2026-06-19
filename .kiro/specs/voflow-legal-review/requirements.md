# Requirements: voflow-legal-review

## Introduction

该 Spec 对齐创作工作台 Step 3“AI 法务审查”。系统需要检查违禁词、敏感词、夸大宣传、版权风险、事实风险和平台规则风险，并提供一键替换、逐条确认、忽略并记录原因。

## User Stories

### US-1 风险分类审查

As a 内容运营, I want 对改写文案进行 AI 法务审查, so that 发布前可以降低违规风险。

#### Acceptance Criteria

1. WHEN 用户选择候选文案 THEN 系统 SHALL 创建 legal_review 节点。
2. WHEN 审查完成 THEN 系统 SHALL 按风险类型输出数量和明细。
3. WHEN 文案存在高风险 THEN 系统 SHALL 将节点置为 waiting_approval。

### US-2 替换建议

As a 内容运营, I want 查看原句、风险原因和建议替换, so that 我可以快速修正文案。

#### Acceptance Criteria

1. WHEN 风险项命中 THEN 系统 SHALL 展示原句、风险原因和建议替换文案。
2. WHEN 用户点击一键替换 THEN 系统 SHALL 生成替换后的文案版本。
3. WHEN 用户逐条确认 THEN 系统 SHALL 只替换已确认风险项。

### US-3 忽略并记录

As a 企业管理员, I want 用户忽略风险时记录原因, so that 后续可以审计发布责任。

#### Acceptance Criteria

1. WHEN 用户忽略风险 THEN 系统 SHALL 要求填写忽略原因。
2. WHEN 忽略原因保存 THEN 系统 SHALL 写入 audit_logs。
3. IF 高风险项未替换且未忽略 THEN 系统 SHALL 阻止进入 TTS。

## Glossary

| Term | Definition |
| --- | --- |
| legal_review | AI 法务审查工作流节点 |
| 风险项 | 命中的违禁、敏感、夸大、版权、事实或平台规则风险 |
| 替换建议 | 系统为风险句子生成的低风险替代表达 |
