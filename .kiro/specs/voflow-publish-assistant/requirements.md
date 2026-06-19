# Requirements: voflow-publish-assistant

## Introduction

该 Spec 对齐创作工作台 Step 7/8 和发布中心页面。系统生成各平台标题、标签、描述、话题和封面参数，管理平台账号授权，执行发布参数检查、一键发布、状态同步和失败重试。

## User Stories

### US-1 发布信息生成

As a 内容运营, I want 为不同平台生成标题、标签、描述和话题, so that 每个平台发布内容符合平台限制。

#### Acceptance Criteria

1. WHEN 最终文案存在 THEN 系统 SHALL 为目标平台生成标题、标签、描述和话题。
2. WHEN 平台限制不同 THEN 系统 SHALL 展示标题字数、标签数量、封面比例和视频时长限制。
3. WHEN 用户修改发布信息 THEN 系统 SHALL 保存平台独立草稿。

### US-2 账号授权状态

As a 内容运营, I want 查看各平台账号授权状态, so that 一键发布前可以处理失效账号。

#### Acceptance Criteria

1. WHEN 用户打开发布中心 THEN 系统 SHALL 展示各平台账号昵称和授权状态。
2. IF token 过期 THEN 系统 SHALL 展示重新授权入口。
3. IF 平台未连接 THEN 系统 SHALL 展示授权入口。

### US-3 发布参数检查

As a 内容运营, I want 发布前检查参数, so that 不符合平台要求的视频不会提交。

#### Acceptance Criteria

1. WHEN 用户点击发布前检查 THEN 系统 SHALL 校验视频比例、标题长度、标签数量、封面尺寸和授权状态。
2. IF 任一必填项不通过 THEN 系统 SHALL 阻止发布并展示原因。

### US-4 一键发布和重试

As a 内容运营, I want 一键发布到已授权平台, so that 我可以减少重复上传操作。

#### Acceptance Criteria

1. WHEN 用户点击一键发布 THEN 系统 SHALL 对已授权且检查通过的平台创建发布任务。
2. WHEN 部分平台失败 THEN 系统 SHALL 标记部分成功并保存失败原因。
3. WHEN 用户点击重试 THEN 系统 SHALL 只重试失败平台。

## Glossary

| Term | Definition |
| --- | --- |
| 发布草稿 | 针对某个平台保存的标题、描述、标签、话题、封面配置 |
| channel account | 已授权的第三方平台账号 |
| 发布适配器 | 封装平台 OAuth、上传、发布、状态查询的模块 |
