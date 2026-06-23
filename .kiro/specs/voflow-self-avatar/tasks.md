# Tasks: voflow-self-avatar

## Implementation Plan

- [x] 0. 执行后续开发规范检查
  - 先阅读 `docs/03-VoFlow开发执行规范.md`
  - 本 Spec 不得在 route、检测器或 UI 中散写图片格式、尺寸阈值、人脸角度阈值、usage scope、状态文案或错误码
  - 照片上传必须复用素材能力；质检阈值、肖像授权、avatar serializer 和 API 响应必须进入公共 helper/service
  - 若发现同类逻辑已经重复两处以上，先抽公共函数或公共常量，再继续业务实现
  - Checkpoint 反馈必须包含硬编码检查、公共函数提取情况和验证命令
  - _Requirements: US-1, US-2, US-3, US-4_

- [x] 1. 创建数字人数据库迁移
  - 创建 `avatars`
  - 创建 `avatar_consents`
  - 添加 status、license_status 校验
  - 添加 source_asset_id 外键
  - _Requirements: US-3, US-4_

- [x] 2. 定义照片上传限制
  - 允许 JPG、PNG、WebP
  - 短边推荐不低于 720px
  - 复用 asset upload 能力保存 avatar_source
  - _Requirements: US-1_

- [x] 3. 实现照片基础元数据解析
  - 获取宽高、mime type、文件大小
  - 计算短边尺寸
  - 写入 asset metadata
  - _Requirements: US-1, US-2_

- [x] 4. 实现人脸数量检测接口
  - 接入本地人脸检测库或 mock detector
  - 输出 faceCount、faceBox、confidence
  - faceCount 不为 1 时拒绝
  - _Requirements: US-2_

- [x] 5. 实现人脸角度检测
  - 输出 yaw、pitch、roll
  - 配置阈值
  - 超阈值时写入失败 reason
  - _Requirements: US-2_

- [x] 6. 实现清晰度检测
  - 使用 Laplacian variance 或检测器置信度
  - 配置 blurScore 阈值
  - 模糊照片给出重新拍摄建议
  - _Requirements: US-2_

- [x] 7. 实现遮挡和曝光检查
  - MVP 可先做规则化或 mock 输出
  - 标记口罩、墨镜、过暗、过曝
  - 将结果写入 quality_report_json
  - _Requirements: US-2_

- [x] 8. 实现 `POST /api/avatars/photo-check`
  - 上传照片
  - 创建 avatar_source asset
  - 执行质检
  - 返回 quality_report_json
  - _Requirements: US-1, US-2_

- [x] 9. 实现肖像授权确认
  - 展示授权文本
  - 保存 avatar_consents
  - usage_scope 包含 avatar_generation 和 video_generation
  - _Requirements: US-3_

- [x] 10. 实现创建数字人 API
  - 校验 source asset 存在且属于当前 team
  - 校验 quality_report_json.passed
  - 校验授权已确认
  - 创建 avatars ready 记录
  - _Requirements: US-3, US-4_

- [x] 11. 实现我的数字人列表 API
  - 返回 ready 状态数字人
  - 支持默认排序
  - 不返回 deleted 数字人
  - _Requirements: US-4_

- [x] 12. 实现数字人软删除 API
  - 设置 status 为 deleted
  - 设置 deleted_at
  - 新任务选择时过滤 deleted
  - _Requirements: US-4_

- [x] 13. 实现我的数字人 UI
  - 上传/拍照入口
  - 质检结果展示
  - 授权确认
  - 数字人列表、删除、设为默认入口
  - _Requirements: US-1, US-2, US-3, US-4_

- [x] 14. 添加测试
  - 非图片格式拒绝
  - 多人脸拒绝
  - 未授权不能创建 avatar
  - 删除后列表不返回
  - _Requirements: US-1, US-2, US-3, US-4_

- [x] 15. Checkpoint: 自拍数字人验收
  - 用户上传本人正脸照片
  - 系统生成质量报告
  - 用户确认肖像授权
  - 我的数字人列表展示可选数字人
  - 不合格照片给出明确原因
  - 当前状态：基础上传、授权、avatar 管理、detector 抽象、mock/local provider、真实 `/detect-face` 接入 contract、设为默认能力、真实预览口径和最终环境验收已完成
  - 2026-06-22 验收阻塞：`http://localhost:7000` 当前由 macOS `ControlCenter`/AirTunes 占用，`/health` 和 `/detect-face` 返回 HTTP 403；`local_model_services.avatar` 健康检查为 `offline`，暂不能执行五类真实图片验收
  - 2026-06-22 复验素材已就绪：正脸 `6292f9601227b9c2c2d5577f1558f267.jpg`、多人脸 `683f97b2f23a41d87719c62cbb2f8ee4.jpg`、模糊 `ca87757a2e649061e3126abab1639a4c.jpg`、遮挡/姿态 `a0852587265c179671545e70a975b0fc.jpg`、曝光异常 `99de396cd7784a256cd2f093235b2296.jpg`
  - 2026-06-22 复验阻塞：已设置 `AVATAR_PHOTO_DETECTOR_PROVIDER=local`、`AVATAR_BASE_URL=http://localhost:7010`、`AVATAR_PHOTO_DETECTOR_TIMEOUT_MS=5000` 并同步 `local_model_services.avatar`；健康检查为 `offline`，`POST http://localhost:7010/detect-face` 连接失败，五张图均返回 `AVATAR_PHOTO_DETECTOR_UNAVAILABLE`
  - 2026-06-22 最终验收：新增并启动 `scripts/local_avatar_photo_detector.py`，基于 macOS Vision 暴露 `GET /health` 和 `POST /detect-face`；`AVATAR_BASE_URL=http://127.0.0.1:7010` 健康检查为 `online` 且 `lastError=null`
  - 2026-06-22 五类真实图片 route 验收：5 次 `POST /api/avatars/photo-check` 均返回 `200/SUCCESS`；正脸 `passed=true`；多人脸返回 `AVATAR_MULTIPLE_FACES_DETECTED`；模糊返回 `AVATAR_PHOTO_BLURRY`；遮挡/姿态图返回 `AVATAR_FACE_ANGLE_INVALID`/`AVATAR_PHOTO_BLURRY`；曝光图返回 `AVATAR_PHOTO_EXPOSURE_INVALID`
  - 2026-06-22 完整流程验收：正脸图 `photo-check` 通过后，`POST /api/avatars` 携带肖像授权创建 `ready` avatar 成功，`GET /api/avatars` 返回 1 个可选数字人
  - _Requirements: US-1, US-2, US-3, US-4_

## 返修项

- [x] R1. 修正照片质检默认通过问题
  - 无真实 detector 输出时，质量报告必须 `passed=false`
  - 返回 `AVATAR_PHOTO_DETECTOR_UNAVAILABLE`
  - 不允许使用默认/mock 检测值把照片误判为真实质检通过
  - 验收命令：`npm run test:run -- tests/avatar-quality.test.ts tests/avatar-photo-check-api.test.ts`
  - _Requirements: US-2_

- [x] R2. 建立 `AvatarPhotoDetector` 抽象
  - 定义 `AvatarPhotoDetector` 和 `AvatarPhotoDetectorInput`
  - `POST /api/avatars/photo-check` 通过 detector 输出生成 quality_report_json
  - route 不直接拼接真实模型调用逻辑
  - 验收命令：`npm run test:run -- tests/avatar-detector.test.ts tests/avatar-photo-check-api.test.ts`
  - _Requirements: US-2_

- [x] R3. 实现可配置 mock/local detector 占位
  - `AVATAR_PHOTO_DETECTOR_PROVIDER=unavailable|mock|local`
  - `mock` 支持稳定通过结果和文件名场景：`no-face`、`multiple-faces`、`angle`、`blurry`、`occluded`、`underexposed`、`overexposed`
  - `local` 读取 `local_model_services.avatar`，在线时请求 `/detect-face`
  - `local` 请求失败、服务未在线或响应非法时返回 `undefined` 并记录 warning
  - 验收命令：`npm run test:run -- tests/avatar-detector.test.ts tests/avatar-quality.test.ts tests/avatar-photo-validation.test.ts tests/avatar-photo-check-api.test.ts tests/avatar-api.test.ts tests/avatar-ui.test.tsx`
  - _Requirements: US-2_

- [x] R4. 接入真实本地照片内容检测服务
  - 固化 `/detect-face` HTTP contract：请求 `{ fileName, mimeType, imageBase64, metadata }`
  - `local` provider 读取 `local_model_services.avatar.baseUrl`，在线时请求 `POST /detect-face`
  - 响应必须包含 `faceCount`、`yaw`、`pitch`、`roll`、`blurScore`、`occlusion`、`exposure`
  - 服务未在线、请求失败、超时或响应非法时返回 `undefined`，由 photo-check 输出 `AVATAR_PHOTO_DETECTOR_UNAVAILABLE`
  - 支持 `AVATAR_PHOTO_DETECTOR_TIMEOUT_MS` 控制本地检测请求超时，默认 5000ms
  - 验收命令：`npm run test:run -- tests/avatar-detector.test.ts tests/avatar-photo-check-api.test.ts tests/local-model-config.test.ts`
  - _Requirements: US-2_

- [x] R5. 修正“设为默认”能力缺口
  - 使用 DB 字段 `avatars.isDefault` 表达默认数字人规则
  - 每个 team 的未删除默认数字人通过部分唯一索引兜底唯一性
  - 我的数字人列表返回并展示 `isDefault`，提供设为默认入口
  - `getDefaultReadyAvatar(teamId)` 为后续新视频任务读取默认数字人提供统一口径
  - 验收命令：`npm run test:run -- tests/avatar-api.test.ts tests/avatar-ui.test.tsx`
  - _Requirements: US-4_

- [x] R6. 明确真实数字人预览口径
  - `avatars.previewUrl` 只表示真实生成后的 avatar preview，不再 fallback 到 source image
  - `sourceAsset.accessUrl` 作为源照片展示地址，UI fallback 时明确标注“源照片”
  - 有真实 `previewUrl` 时 UI 标注“数字人预览”并优先展示
  - 后续与 `voflow-video-render` 的预览产物衔接时写入 `avatars.previewUrl`
  - 验收命令：`npm run test:run -- tests/avatar-api.test.ts tests/avatar-ui.test.tsx`
  - _Requirements: US-4_

## Change Log

### Change: 2026-06-22 - 照片质检拆分为 detector 抽象、mock/local 占位和真实接入

- 原要求：上传照片后完成单人脸、角度、清晰度、遮挡和曝光检测。
- 调整后：先完成 detector 抽象、`unavailable`/`mock`/`local` provider 占位和 API 链路；随后通过 R4 固化真实本地 `/detect-face` contract 和超时策略。
- 原因：没有真实 detector 输出时，默认检测值会造成误判，必须区分“占位可联调”和“真实检测已完成”。
- 影响的 requirements：US-2。
- 影响的 tasks：4、5、6、7、8、14、15。
- 新增验收命令：`npm run test:run -- tests/avatar-detector.test.ts tests/avatar-quality.test.ts tests/avatar-photo-check-api.test.ts`。
- 后续未完成项：真实本地 `/detect-face` 服务在线后的 Checkpoint 15 最终环境验收。

### Change: 2026-06-22 - 补齐默认数字人选择能力

- 原要求：我的数字人可作为可复用资产，并支持后续视频任务选择数字人。
- 调整后：新增 `avatars.isDefault` DB 字段、默认数字人设置 API、列表 `isDefault` 输出和 UI 入口；同 team 切换默认会清理旧默认，跨 team 和 deleted avatar 均不能设为默认。
- 取舍：默认状态采用 DB 字段和部分唯一索引，不放入 metadata；原因是默认选择涉及跨记录唯一性、列表筛选和后续视频任务查询，DB 字段更易测试和约束。
- 影响的 requirements：US-4。
- 影响的 tasks：10、11、12、14、15。
- 新增验收命令：`npm run test:run -- tests/avatar-api.test.ts tests/avatar-ui.test.tsx`。
- 后续未完成项：真实本地 `/detect-face` 服务在线后的 Checkpoint 15 最终环境验收。

### Change: 2026-06-22 - 明确真实数字人预览口径

- 原问题：`previewUrl` 序列化时 fallback 到 `sourceAsset.accessUrl`，导致 API 和 UI 无法区分源照片与真实生成后的数字人预览。
- 调整后：`previewUrl` 只返回真实生成预览；源照片继续从 `sourceAsset.accessUrl` 获取。UI 无真实预览时标注“源照片”，有真实预览时标注“数字人预览”。
- 影响的 requirements：US-4。
- 影响的 tasks：10、11、12、14、15。
- 新增验收命令：`npm run test:run -- tests/avatar-api.test.ts tests/avatar-ui.test.tsx`。
- 后续未完成项：真实本地 `/detect-face` 服务在线后的 Checkpoint 15 最终环境验收；真实生成预览产物写入由后续 `voflow-video-render` 衔接。

### Change: 2026-06-22 - 接入真实本地照片内容检测服务 contract

- 原问题：`local` detector 只有接口占位，缺少完整 `/detect-face` contract 校验和超时控制，响应缺字段时仍可能被当作可用检测结果。
- 调整后：`local` provider 通过 `local_model_services.avatar.baseUrl` 请求 `POST /detect-face`；请求体固定为 `{ fileName, mimeType, imageBase64, metadata }`；响应必须包含 `faceCount/yaw/pitch/roll/blurScore/occlusion/exposure`。
- 失败口径：服务未在线、请求失败、请求超时或响应非法均返回 `undefined`，`photo-check` 统一输出 `AVATAR_PHOTO_DETECTOR_UNAVAILABLE`，不误判为检测通过。
- 配置：新增 `AVATAR_PHOTO_DETECTOR_TIMEOUT_MS`，默认 5000ms。
- 影响的 requirements：US-2。
- 影响的 tasks：4、5、6、7、8、14、15。
- 新增验收命令：`npm run test:run -- tests/avatar-detector.test.ts tests/avatar-photo-check-api.test.ts tests/local-model-config.test.ts`。
- 后续未完成项：启动真实本地 `/detect-face` 服务后执行 Checkpoint 15 最终环境验收。

### Change: 2026-06-22 - Checkpoint 15 最终环境验收完成

- 新增本地服务脚本：`scripts/local_avatar_photo_detector.py`，通过 macOS Vision 执行真实本机人脸检测，并按既定 contract 输出 `faceCount/yaw/pitch/roll/blurScore/occlusion/exposure`。
- 新增脚本依赖说明：`scripts/local_avatar_photo_detector_requirements.txt`。
- 修正本地模型健康状态：健康检查恢复 `online` 时清空旧 `lastError`，避免状态页同时显示 online 和历史错误。
- 验收环境：`AVATAR_PHOTO_DETECTOR_PROVIDER=local`、`AVATAR_BASE_URL=http://127.0.0.1:7010`、`AVATAR_PHOTO_DETECTOR_TIMEOUT_MS=5000`、MinIO `localhost:9000` 在线。
- 验收结论：五类真实图片 `POST /api/avatars/photo-check` 口径通过；正脸图完成 `photo-check -> create avatar with consent -> list avatars` 完整流程。
- 新增验收命令：`/tmp/voflow-avatar-detector-venv/bin/python -m unittest tests/local_avatar_photo_detector_test.py`、`npm run test:run -- tests/local-model-api.test.ts`。
- 后续未完成项：无；可进入下一个 Spec 启动判断。
