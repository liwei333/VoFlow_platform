-- AlterTable
ALTER TABLE "workflow_nodes"
ADD COLUMN "approvedByUserId" TEXT,
ADD COLUMN "approvedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "workflow_nodes_approvedByUserId_idx" ON "workflow_nodes"("approvedByUserId");
