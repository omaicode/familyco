-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "traceId" TEXT;

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT,
    "rootAgentId" TEXT NOT NULL,
    "parentRunId" TEXT,
    "triggerType" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "inputSummary" TEXT NOT NULL,
    "outputSummary" TEXT,
    "linkedProjectId" TEXT,
    "linkedTaskId" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentRun_rootAgentId_fkey" FOREIGN KEY ("rootAgentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentRun_parentRunId_fkey" FOREIGN KEY ("parentRunId") REFERENCES "AgentRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgentRun_linkedProjectId_fkey" FOREIGN KEY ("linkedProjectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgentRun_linkedTaskId_fkey" FOREIGN KEY ("linkedTaskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT,
    "runId" TEXT,
    "agentId" TEXT,
    "projectId" TEXT,
    "taskId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "estimatedCost" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BudgetUsage_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BudgetUsage_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BudgetUsage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BudgetUsage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AgentRun_rootAgentId_createdAt_idx" ON "AgentRun"("rootAgentId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_state_createdAt_idx" ON "AgentRun"("state", "createdAt");

-- CreateIndex
CREATE INDEX "BudgetUsage_recordedAt_idx" ON "BudgetUsage"("recordedAt");

-- CreateIndex
CREATE INDEX "BudgetUsage_provider_model_idx" ON "BudgetUsage"("provider", "model");

-- CreateIndex
CREATE INDEX "BudgetUsage_runId_idx" ON "BudgetUsage"("runId");
