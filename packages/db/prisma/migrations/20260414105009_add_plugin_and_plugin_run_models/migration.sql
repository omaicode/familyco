-- CreateTable
CREATE TABLE "Plugin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "author" TEXT,
    "tags" JSONB NOT NULL DEFAULT [],
    "path" TEXT NOT NULL,
    "entry" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL DEFAULT [],
    "state" TEXT NOT NULL DEFAULT 'discovered',
    "approvalMode" TEXT NOT NULL DEFAULT 'require_review',
    "checksum" TEXT NOT NULL,
    "errorMessage" TEXT,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PluginRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pluginId" TEXT NOT NULL,
    "agentRunId" TEXT,
    "capability" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "inputJson" JSONB,
    "outputJson" JSONB,
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PluginRun_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "Plugin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PluginRun_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Plugin_path_key" ON "Plugin"("path");

-- CreateIndex
CREATE INDEX "Plugin_state_idx" ON "Plugin"("state");

-- CreateIndex
CREATE INDEX "PluginRun_pluginId_createdAt_idx" ON "PluginRun"("pluginId", "createdAt");

-- CreateIndex
CREATE INDEX "PluginRun_agentRunId_idx" ON "PluginRun"("agentRunId");

-- CreateIndex
CREATE INDEX "PluginRun_state_idx" ON "PluginRun"("state");
