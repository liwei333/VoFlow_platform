-- CreateEnum
CREATE TYPE "LocalModelServiceType" AS ENUM ('llm', 'asr', 'tts', 'avatar', 'ffmpeg');

-- CreateEnum
CREATE TYPE "LocalModelServiceStatus" AS ENUM ('online', 'offline', 'busy', 'misconfigured');

-- CreateTable
CREATE TABLE "local_model_services" (
    "id" TEXT NOT NULL,
    "serviceType" "LocalModelServiceType" NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT,
    "modelName" TEXT,
    "status" "LocalModelServiceStatus" NOT NULL DEFAULT 'misconfigured',
    "latencyMs" INTEGER,
    "resource" JSONB,
    "lastError" JSONB,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_model_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "local_model_services_serviceType_key" ON "local_model_services"("serviceType");

-- CreateIndex
CREATE INDEX "local_model_services_status_idx" ON "local_model_services"("status");
