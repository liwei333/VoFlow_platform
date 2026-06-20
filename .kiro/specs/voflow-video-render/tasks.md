# Tasks: voflow-video-render

## Implementation Plan

- [ ] 0. 执行后续开发规范检查
  - 先阅读 `docs/03-VoFlow开发执行规范.md`
  - 本 Spec 不得在 Worker、API 或 UI 中散写渲染服务地址、预览/高清分辨率、crop 选项、错误码、状态文案或 artifact 路径
  - Avatar 服务 baseUrl、服务状态、状态文案和健康检查必须复用 `voflow-local-model-monitor` 的 `avatar` 服务注册表、配置 helper、health adapter 和 API
  - Avatar render provider、输入校验、ffprobe 校验、artifact 写入和 API 响应必须进入公共 helper/service
  - 若发现同类逻辑已经重复两处以上，先抽公共函数或公共常量，再继续业务实现
  - Checkpoint 反馈必须包含硬编码检查、公共函数提取情况和验证命令
  - _Requirements: US-1, US-2, US-3, US-4_

- [ ] 1. 创建渲染请求数据库迁移
  - 创建 `avatar_render_requests`
  - 添加 mode、crop、aspect_ratio 校验
  - 关联 job、node、avatar、audio artifact
  - _Requirements: US-1, US-4_

- [ ] 2. 定义 Avatar Render Provider 接口
  - `renderAvatarVideo(payload)`
  - 返回视频路径、duration、resolution、model
  - 实现 mock provider 生成可播放测试视频
  - provider 只消费 `avatar` 服务的 `baseUrl` 和业务渲染参数，不直接读取 `AVATAR_BASE_URL`
  - _Requirements: US-2, US-3_

- [ ] 3. 实现渲染输入校验服务
  - 校验 avatar ready
  - 校验 avatar license approved
  - 校验 TTS audio artifact 存在
  - 校验 aspectRatio 与项目一致
  - _Requirements: US-1, US-4_

- [ ] 4. 实现预览渲染 API
  - 创建 preview render request
  - 投递 avatar_render 节点
  - 设置 renderOptions resolution 为低清
  - _Requirements: US-2, US-4_

- [ ] 5. 实现 Avatar Render Worker
  - 下载 source image 和 audio
  - 调用 provider
  - 上传 avatar_video 到对象存储
  - 写入 artifact
  - _Requirements: US-2, US-3_

- [ ] 6. 实现输出视频校验
  - 校验文件存在且大小大于阈值
  - 使用 ffprobe 校验 duration 和 video stream
  - 失败时返回 invalid output 错误
  - _Requirements: US-2, US-3_

- [ ] 7. 实现预览确认流程
  - 预览成功后节点 waiting_approval
  - 用户确认后创建 hd request
  - 用户不满意时允许重试 preview
  - _Requirements: US-2, US-3_

- [ ] 8. 实现高清渲染 API
  - 只允许在 preview approved 后调用
  - 创建 hd 版本请求
  - 投递高清渲染任务
  - _Requirements: US-3_

- [ ] 9. 接入真实模型服务配置
  - 从 `local_model_services` 读取 `avatar` 服务的 `baseUrl` 和 `status`
  - 不在渲染模块重新读取或定义 `AVATAR_BASE_URL`
  - 实现请求超时和错误码映射
  - 保留 mock provider 作为测试 fallback
  - _Requirements: US-2, US-3_

- [ ] 10. 实现数字人选择和渲染 UI
  - 展示我的数字人列表
  - 展示画面比例和裁剪选项
  - 展示预览播放器和确认按钮
  - _Requirements: US-1, US-2, US-4_

- [ ] 11. 添加测试
  - avatar not ready 被拒绝
  - audio artifact 缺失被拒绝
  - mock provider 输出 artifact
  - invalid output 标记节点失败
  - _Requirements: US-1, US-2, US-3, US-4_

- [ ] 12. Checkpoint: 数字人渲染验收
  - 用户选择我的数字人和 TTS 音频
  - 系统生成可播放低清预览
  - 用户确认后生成高清中间视频
  - 失败任务可重试且历史版本保留
  - _Requirements: US-1, US-2, US-3, US-4_
