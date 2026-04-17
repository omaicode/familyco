-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "founderId" TEXT NOT NULL DEFAULT 'founder',
    "title" TEXT NOT NULL DEFAULT 'New chat',
    "summary" TEXT NOT NULL DEFAULT '',
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatSession_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ChatSession" ("agentId", "createdAt", "founderId", "id", "lastMessageAt", "title", "updatedAt") SELECT "agentId", "createdAt", "founderId", "id", "lastMessageAt", "title", "updatedAt" FROM "ChatSession";
DROP TABLE "ChatSession";
ALTER TABLE "new_ChatSession" RENAME TO "ChatSession";
CREATE INDEX "ChatSession_agentId_founderId_lastMessageAt_idx" ON "ChatSession"("agentId", "founderId", "lastMessageAt");
CREATE INDEX "ChatSession_agentId_createdAt_idx" ON "ChatSession"("agentId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
