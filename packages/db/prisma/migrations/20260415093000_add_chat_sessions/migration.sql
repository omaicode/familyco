-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "founderId" TEXT NOT NULL DEFAULT 'founder',
    "title" TEXT NOT NULL DEFAULT 'New chat',
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatSession_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ChatSession_agentId_founderId_lastMessageAt_idx" ON "ChatSession"("agentId", "founderId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ChatSession_agentId_createdAt_idx" ON "ChatSession"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_senderId_idx" ON "ChatMessage"("sessionId", "senderId");

-- Backfill: keep existing chat history by creating one legacy session per agent.
INSERT INTO "ChatSession" ("id", "agentId", "founderId", "title", "lastMessageAt", "createdAt", "updatedAt")
SELECT
  'legacy-' || "agentId" AS "id",
  "agentId",
  'founder' AS "founderId",
  'Imported chat' AS "title",
  MAX("createdAt") AS "lastMessageAt",
  MIN("createdAt") AS "createdAt",
  CURRENT_TIMESTAMP AS "updatedAt"
FROM (
  SELECT
    CASE
      WHEN "recipientId" = 'founder' THEN "senderId"
      ELSE "recipientId"
    END AS "agentId",
    "createdAt"
  FROM "InboxMessage"
  WHERE ("senderId" = 'founder' OR "recipientId" = 'founder')
    AND (
      "title" LIKE 'Reply from %'
      OR json_extract("payload", '$.channel') = 'chat'
      OR json_type(json_extract("payload", '$.toolCalls')) IS NOT NULL
    )
)
GROUP BY "agentId";

-- Backfill chat rows into ChatMessage.
INSERT INTO "ChatMessage" (
  "id",
  "sessionId",
  "senderId",
  "recipientId",
  "type",
  "title",
  "body",
  "payload",
  "createdAt",
  "updatedAt"
)
SELECT
  lower(hex(randomblob(16))) AS "id",
  'legacy-' || "agentId" AS "sessionId",
  "senderId",
  "recipientId",
  "type",
  "title",
  "body",
  "payload",
  "createdAt",
  "updatedAt"
FROM (
  SELECT
    CASE
      WHEN "recipientId" = 'founder' THEN "senderId"
      ELSE "recipientId"
    END AS "agentId",
    "senderId",
    "recipientId",
    "type",
    "title",
    "body",
    "payload",
    "createdAt",
    "updatedAt"
  FROM "InboxMessage"
  WHERE ("senderId" = 'founder' OR "recipientId" = 'founder')
    AND (
      "title" LIKE 'Reply from %'
      OR json_extract("payload", '$.channel') = 'chat'
      OR json_type(json_extract("payload", '$.toolCalls')) IS NOT NULL
    )
)
ORDER BY "createdAt" ASC;
