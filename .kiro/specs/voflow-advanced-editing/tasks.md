# Tasks: voflow-advanced-editing

## Implementation Plan

- [ ] 0. 执行后续开发规范检查
  - 先阅读 `docs/03-VoFlow开发执行规范.md`
  - 本 Spec 不得在 API、Worker 或 UI 中散写字幕样式、BGM 音量、画中画位置、转场参数、错误码、状态文案或素材授权规则
  - 剪辑配置 schema、素材授权校验、预览 Worker、字幕样式模板和 API 响应必须进入公共 helper/service
  - 若发现同类逻辑已经重复两处以上，先抽公共函数或公共常量，再继续业务实现
  - Checkpoint 反馈必须包含硬编码检查、公共函数提取情况和验证命令
  - _Requirements: US-1, US-2, US-3_

- [ ] 1. 创建剪辑配置数据表
  - 创建 `editing_configs`
  - 添加 pip_position、volume、size 校验
  - 绑定 job_id 和 preview_artifact_id
  - _Requirements: US-1, US-2, US-3_

- [ ] 2. 实现剪辑配置查询 API
  - 返回默认字幕、BGM、画中画、背景、转场配置
  - 若未配置则生成默认值
  - _Requirements: US-1, US-2, US-3_

- [ ] 3. 实现剪辑配置保存 API
  - 保存字幕开关和关键词高亮
  - 保存画中画参数
  - 保存音量和转场参数
  - _Requirements: US-1, US-2, US-3_

- [ ] 4. 实现画中画素材授权校验
  - 校验 pip_asset_id 属于当前 team
  - 校验 license_status approved
  - 未授权时拒绝保存
  - _Requirements: US-2_

- [ ] 5. 实现背景素材授权校验
  - 支持背景图和背景视频
  - 校验素材授权
  - 记录背景素材引用
  - _Requirements: US-3_

- [ ] 6. 实现关键词高亮配置生成
  - 从确认文案中提取关键词
  - 允许用户开关高亮
  - 输出 ASS 字幕可用样式配置
  - _Requirements: US-1_

- [ ] 7. 实现剪辑预览 Worker
  - 可先返回轻量预览配置
  - 后续用 FFmpeg 生成低清预览
  - 保存 preview artifact
  - _Requirements: US-3_

- [ ] 8. 实现视频剪辑 UI
  - 字幕开关、关键词高亮、BGM 自动闪避
  - 画中画开关、大小和位置
  - 人声/BGM 音量、转场强度
  - 剪辑预览按钮
  - _Requirements: US-1, US-2, US-3_

- [ ] 9. 添加测试
  - 未授权画中画素材被拒绝
  - 音量越界被拒绝
  - 保存配置后可查询
  - 预览失败写入错误
  - _Requirements: US-1, US-2, US-3_

- [ ] 10. Checkpoint: 高级剪辑验收
  - 用户可保存字幕/BGM/画中画/背景/转场配置
  - 未授权素材不能用于画中画或背景
  - 配置可传递给最终导出节点
  - _Requirements: US-1, US-2, US-3_
