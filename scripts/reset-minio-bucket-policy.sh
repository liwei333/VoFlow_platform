#!/bin/bash
# 重置 MinIO bucket 公开策略
# 用法: ./scripts/reset-minio-bucket-policy.sh

set -e

MINIO_ALIAS="myminio"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-localhost:9000}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-voflow}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-voflow123}"
MINIO_BUCKET="${MINIO_BUCKET:-voflow}"

echo "设置 MinIO alias..."
mc alias set $MINIO_ALIAS http://$MINIO_ENDPOINT $MINIO_ACCESS_KEY $MINIO_SECRET_KEY

echo "检查 bucket 是否存在..."
if mc ls $MINIO_ALIAS/$MINIO_BUCKET > /dev/null 2>&1; then
  echo "Bucket '$MINIO_BUCKET' 存在"

  echo "移除 bucket 公开读策略..."
  mc anonymous set none $MINIO_ALIAS/$MINIO_BUCKET 2>/dev/null || echo "策略已为空或不存在"

  echo "验证策略..."
  POLICY=$(mc anonymous get $MINIO_ALIAS/$MINIO_BUCKET 2>/dev/null || echo "none")
  echo "当前策略: $POLICY"

  echo "✅ Bucket '$MINIO_BUCKET' 策略已重置为私有"
else
  echo "Bucket '$MINIO_BUCKET' 不存在，无需重置"
fi
