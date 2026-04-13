-- CreateTable
CREATE TABLE "TaskSessionCheckpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "checkpointIndex" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "lastToolNames" TEXT NOT NULL DEFAULT '[]',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskSessionCheckpoint_taskId_key" ON "TaskSessionCheckpoint"("taskId");

-- CreateIndex
CREATE INDEX "TaskSessionCheckpoint_agentId_idx" ON "TaskSessionCheckpoint"("agentId");

-- CreateIndex
CREATE INDEX "TaskSessionCheckpoint_status_idx" ON "TaskSessionCheckpoint"("status");
