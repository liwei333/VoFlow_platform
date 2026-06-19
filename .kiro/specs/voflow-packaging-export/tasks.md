# Tasks: voflow-packaging-export

## Implementation Plan

- [ ] 0. 执行后续开发规范检查
  - 先阅读 `docs/03-VoFlow开发执行规范.md`
  - 本 Spec 不得在 Worker、API 或 UI 中散写 FFmpeg 参数、字幕样式、BGM 规则、封面尺寸、下载 URL 有效期、错误码或 artifact 路径
  - Export worker、ffprobe 校验、下载 URL、封面/字幕 serializer、端到端测试 fixture 和 API 响应必须进入公共 helper/service
  - 若发现同类逻辑已经重复两处以上，先抽公共函数或公共常量，再继续业务实现
  - Checkpoint 反馈必须包含硬编码检查、公共函数提取情况和验证命令
  - _Requirements: US-1, US-2, US-3, US-4, US-5_

- [ ] 1. 创建导出请求数据库迁移
  - 创建 `export_requests`
  - 添加 output_profile、status 校验
  - 关联 job、node、avatar_video、audio、editing_config、subtitle、cover
  - _Requirements: US-4_

- [ ] 2. 实现字幕生成服务
  - 根据确认文案生成 SRT
  - 支持按标点和长度分句
  - 保存 subtitle artifact
  - _Requirements: US-1_

- [ ] 3. 实现 ASS 字幕样式模板
  - 定义字体、字号、颜色、描边、位置
  - 针对 9:16 默认不遮挡人脸
  - 输出 ASS 文件
  - _Requirements: US-1_

- [ ] 4. 实现 BGM 选择和授权校验
  - 支持无 BGM 默认导出
  - 选择 BGM 时调用 asset 授权校验
  - 未授权 BGM 阻断导出
  - _Requirements: US-2_

- [ ] 5. 实现人声优先混音
  - 使用 FFmpeg/pydub 实现 BGM 音量降低
  - 添加淡入淡出
  - 输出 mixed_audio artifact
  - _Requirements: US-2_

- [ ] 6. 实现封面抽帧
  - 从 avatar_video 中间视频抽取清晰帧
  - MVP 可取中间帧或首个非黑帧
  - 保存 cover base image
  - _Requirements: US-3_

- [ ] 7. 实现封面标题合成
  - 使用标题候选或确认标题
  - 将标题绘制到封面
  - 输出 cover artifact
  - _Requirements: US-3_

- [ ] 8. 实现 Export Worker
  - 读取 avatar_video、audio、subtitle、optional BGM、editing_config
  - 应用画中画、背景、转场和音量参数
  - 调用 FFmpeg 合成最终 MP4
  - 上传 final_video artifact
  - _Requirements: US-1, US-2, US-4_

- [ ] 9. 实现 ffprobe 媒体验收
  - 校验最终 MP4 文件非空
  - 校验包含 video stream
  - 校验包含 audio stream
  - 校验 duration 合理
  - _Requirements: US-4_

- [ ] 10. 实现导出 API
  - 校验所需上游 artifact 存在
  - 创建 export_request
  - 投递 final_export 节点
  - _Requirements: US-4_

- [ ] 11. 实现下载 API
  - 校验 artifact 属于当前 team
  - 生成短期下载 URL
  - 记录下载审计日志
  - _Requirements: US-4_

- [ ] 12. 实现导出 UI
  - 展示字幕预览摘要
  - 支持选择 BGM 或无 BGM
  - 展示封面预览
  - 展示下载按钮
  - _Requirements: US-1, US-2, US-3, US-4_

- [ ] 13. 实现端到端测试脚本
  - 使用 mock ASR/LLM/TTS/avatar provider
  - 从项目、文案、照片、音色跑到 final_video
  - 校验任务节点和 artifact 完整
  - _Requirements: US-5_

- [ ] 14. 实现真实媒体冒烟测试
  - 使用一段短文案、测试头像、测试音频
  - 生成 9:16 MP4
  - 使用 ffprobe 校验音视频流
  - _Requirements: US-4, US-5_

- [ ] 15. 添加失败重试测试
  - 模拟 FFmpeg 失败
  - 检查节点 failed 和错误码
  - 重试后生成新版本 artifact
  - _Requirements: US-4, US-5_

- [ ] 16. Checkpoint: MVP 成片验收
  - 用户上传本人照片并创建数字人
  - 用户输入文案并生成 TTS
  - 系统生成数字人口播视频
  - 系统合成字幕、BGM、画中画、封面、最终 MP4
  - 用户可下载最终视频
  - _Requirements: US-1, US-2, US-3, US-4, US-5_
