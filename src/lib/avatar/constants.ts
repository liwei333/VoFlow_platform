export const AVATAR_PHOTO_MIN_SHORT_SIDE_PX = 720;

export const AVATAR_PHOTO_MIME_TYPES = {
  jpeg: "image/jpeg",
  jpg: "image/jpg",
  png: "image/png",
  webp: "image/webp",
} as const;

export const AVATAR_PHOTO_ACCEPT_MIME_TYPES = [
  AVATAR_PHOTO_MIME_TYPES.jpeg,
  AVATAR_PHOTO_MIME_TYPES.png,
  AVATAR_PHOTO_MIME_TYPES.webp,
] as const;

export const AVATAR_PHOTO_ACCEPT_ATTRIBUTE = AVATAR_PHOTO_ACCEPT_MIME_TYPES.join(",");

export const AVATAR_PHOTO_UPLOAD_HELP_TEXT =
  `JPG、PNG、WebP，短边不低于 ${AVATAR_PHOTO_MIN_SHORT_SIDE_PX}px`;

export const AVATAR_PHOTO_QUALITY_THRESHOLDS = {
  maxAbsYaw: 20,
  maxAbsPitch: 15,
  maxAbsRoll: 15,
  minBlurScore: 100,
} as const;

export const AVATAR_PHOTO_ERROR_CODES = {
  noFace: "AVATAR_NO_FACE_DETECTED",
  multipleFaces: "AVATAR_MULTIPLE_FACES_DETECTED",
  resolutionTooLow: "AVATAR_PHOTO_RESOLUTION_TOO_LOW",
  faceAngleInvalid: "AVATAR_FACE_ANGLE_INVALID",
  photoBlurry: "AVATAR_PHOTO_BLURRY",
  faceOccluded: "AVATAR_FACE_OCCLUDED",
  exposureInvalid: "AVATAR_PHOTO_EXPOSURE_INVALID",
  detectorUnavailable: "AVATAR_PHOTO_DETECTOR_UNAVAILABLE",
  metadataInvalid: "AVATAR_PHOTO_METADATA_INVALID",
} as const;

export const AVATAR_PHOTO_ERROR_MESSAGES = {
  [AVATAR_PHOTO_ERROR_CODES.noFace]: "未检测到人脸，请上传清晰的本人正脸照片",
  [AVATAR_PHOTO_ERROR_CODES.multipleFaces]: "检测到多张人脸，请仅保留本人单人正脸",
  [AVATAR_PHOTO_ERROR_CODES.resolutionTooLow]: "照片分辨率过低，请上传短边不低于 720px 的照片",
  [AVATAR_PHOTO_ERROR_CODES.faceAngleInvalid]: "人脸角度过大，请上传正面拍摄照片",
  [AVATAR_PHOTO_ERROR_CODES.photoBlurry]: "照片清晰度不足，请重新拍摄或上传更清晰的照片",
  [AVATAR_PHOTO_ERROR_CODES.faceOccluded]: "检测到脸部遮挡，请移除口罩、墨镜或其他遮挡物",
  [AVATAR_PHOTO_ERROR_CODES.exposureInvalid]: "照片曝光异常，请上传光线均匀的照片",
  [AVATAR_PHOTO_ERROR_CODES.detectorUnavailable]: "照片内容检测服务未接入，暂不能确认人脸、清晰度、遮挡和曝光",
  [AVATAR_PHOTO_ERROR_CODES.metadataInvalid]: "无法读取照片尺寸信息，请重新上传 JPG、PNG 或 WebP 图片",
} as const;

export const AVATAR_PHOTO_CHECK_API_MESSAGES = {
  missingFile: "缺少文件",
  storageInitFailed: "存储初始化失败",
  uploadFailed: "照片上传失败",
  databaseWriteFailed: "数据库写入失败",
  internalError: "服务器内部错误",
  success: "照片质检完成",
} as const;

export const AVATAR_CONSENT_USAGE_SCOPES = [
  "avatar_generation",
  "video_generation",
] as const;

export const DEFAULT_AVATAR_CONSENT_TYPE = "portrait_license";

export const AVATAR_ERROR_CODES = {
  notFound: "AVATAR_NOT_FOUND",
  sourceAssetNotFound: "AVATAR_SOURCE_ASSET_NOT_FOUND",
  consentRequired: "AVATAR_CONSENT_REQUIRED",
  qualityNotPassed: "AVATAR_PHOTO_QUALITY_NOT_PASSED",
  createFailed: "AVATAR_CREATE_FAILED",
  deleteFailed: "AVATAR_DELETE_FAILED",
} as const;

export const AVATAR_ERROR_MESSAGES = {
  [AVATAR_ERROR_CODES.notFound]: "数字人不存在",
  [AVATAR_ERROR_CODES.sourceAssetNotFound]: "数字人源照片不存在",
  [AVATAR_ERROR_CODES.consentRequired]: "请先确认肖像授权",
  [AVATAR_ERROR_CODES.qualityNotPassed]: "照片质检未通过，无法创建数字人",
  [AVATAR_ERROR_CODES.createFailed]: "数字人创建失败",
  [AVATAR_ERROR_CODES.deleteFailed]: "数字人删除失败",
} as const;

export const AVATAR_API_MESSAGES = {
  listSuccess: "数字人列表加载成功",
  createSuccess: "数字人创建成功",
  consentSuccess: "肖像授权确认成功",
  defaultSuccess: "默认数字人已更新",
  deleteSuccess: "数字人已删除",
} as const;
