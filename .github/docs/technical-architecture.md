# Tài Liệu Kiến Trúc Kỹ Thuật

> Không tự ý thay đổi cấu trúc nếu chưa có approval

---

## 0. Nguyên Tắc Bắt Buộc (AI Coding Rules)

Đây là các ràng buộc không thể vi phạm khi sinh code cho FamilyCo:

1. **Không được tạo logic business ngoài `@familyco/core`** — mọi xử lý agent, task, project, queue đều nằm trong core package.
2. **Không được import Electron vào `@familyco/core` hoặc `@familyco/server`** — core và server phải chạy được độc lập không có Electron.
3. **Không được dùng `localStorage` hoặc `sessionStorage`** — dùng in-memory store hoặc IPC/API call.
4. **Mọi API call ra ngoài (AI provider, webhook, email) phải đi qua `ToolExecutor`** — không gọi thẳng từ component Vue hay từ agent handler.
5. **Mọi thay đổi state của Agent phải emit event qua `EventBus`** — không mutate state trực tiếp từ nơi khác.
6. **Approval mode phải được kiểm tra trước khi thực thi bất kỳ action nào có side-effect** — dùng `ApprovalGuard`.
7. **TypeScript strict mode bật toàn bộ** — không dùng `any`, không tắt strict trong `tsconfig`.
8. **Mỗi module có file `index.ts` export tường minh** — không import đường dẫn nội bộ từ package khác.
9. **Tất cả DB operation đi qua `Repository` pattern** — không query thẳng trong service hay controller.
10. **Test file đặt cạnh source file** — `agent.service.ts` → `agent.service.spec.ts`.

---

## 1. Tech Stack Chính Thức

### Core Runtime
| Layer | Technology | Version | Ghi chú |
|---|---|---|---|
| Language | TypeScript | 5.x (strict) | Toàn bộ codebase |
| Runtime | Node.js | 22 LTS | Server + Embedded |
| Package manager | pnpm | 9.x | Monorepo workspaces |
| Monorepo | pnpm workspaces | — | Không dùng Nx hay Turborepo giai đoạn đầu |

### Desktop
| Layer | Technology | Ghi chú |
|---|---|---|
| Shell | Electron | 34.x |
| UI Framework | Vue 3 | Composition API + `<script setup>` |
| UI State | Pinia | Không dùng Vuex |
| UI Router | Vue Router 4 | Hash mode (Electron) |
| Styling | Tailwind CSS 4 | + CSS Variables (design tokens) |
| Build | Vite + electron-vite | |
| IPC | Electron IPC (contextBridge) | Renderer ↔ Main process |

### Server
| Layer | Technology | Ghi chú |
|---|---|---|
| HTTP Framework | Fastify | v5 — nhanh hơn Express, TypeScript-first |
| WebSocket | `@fastify/websocket` | Real-time event push |
| Job Queue | BullMQ | Redis-backed, retry, delay, priority |
| Redis | ioredis | Queue + pub/sub |
| ORM | Prisma | Schema-first, type-safe |
| DB mặc định | SQLite (Desktop) / PostgreSQL (Server Only) | Prisma adapter |
| Auth | JWT + API Key | `@fastify/jwt` |
| Validation | Zod | Schema validation toàn bộ API input |
| Logging | Pino | Structured JSON log |

### AI / Agent
| Layer | Technology | Ghi chú |
|---|---|---|
| AI SDK | Vercel AI SDK (`ai` package) | Chuẩn hóa multi-provider |
| Providers | OpenAI, Anthropic, Google AI | Qua Vercel AI SDK |
| Tool calling | Vercel AI SDK `tool()` | Chuẩn hóa tool definition |
| Streaming | AI SDK `streamText` | Real-time response |

---

## 2. Monorepo Structure

```
familyco/
├── packages/
│   ├── core/                    # @familyco/core
│   ├── server/                  # @familyco/server
│   ├── desktop/                 # @familyco/desktop (Electron)
│   ├── ui/                      # @familyco/ui (Vue 3)
│   └── cli/                     # @familyco/cli (Server Only console)
├── prisma/
│   └── schema.prisma            # Single source of truth cho DB schema
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

### Dependency Graph (bắt buộc theo chiều này)

```
@familyco/ui        →  @familyco/core (types only)
@familyco/desktop   →  @familyco/server + @familyco/ui
@familyco/server    →  @familyco/core
@familyco/cli       →  @familyco/server (hoặc core trực tiếp)
@familyco/core      →  (không import package nào trong monorepo)
```

**Core không được import từ server, desktop, ui, cli.**

---

## 3. Cấu Trúc `@familyco/core`

```
packages/core/src/
├── agent/
│   ├── agent.entity.ts          # AgentProfile interface + type defs
│   ├── agent.service.ts         # Business logic: create, update, pause, archive
│   ├── agent.service.spec.ts
│   ├── agent.repository.ts      # Abstract repository interface
│   └── index.ts
├── task/
│   ├── task.entity.ts
│   ├── task.service.ts
│   ├── task.service.spec.ts
│   ├── task.repository.ts
│   └── index.ts
├── project/
│   ├── project.entity.ts
│   ├── project.service.ts
│   ├── project.repository.ts
│   └── index.ts
├── inbox/
│   ├── message.entity.ts        # MessageType enum, Message interface
│   ├── inbox.service.ts
│   ├── inbox.repository.ts
│   └── index.ts
├── approval/
│   ├── approval-guard.ts        # ApprovalGuard — check trước mọi side-effect action
│   ├── approval.entity.ts
│   ├── approval.service.ts
│   └── index.ts
├── engine/
│   ├── agent-runner.ts          # Chạy một agent turn: nhận input → gọi AI → xử lý tool calls
│   ├── tool-executor.ts         # ToolExecutor — dispatcher cho tất cả tools
│   ├── tool-registry.ts         # Đăng ký tools available
│   └── index.ts
├── queue/
│   ├── job.types.ts             # JobPayload types
│   ├── queue.service.ts         # Abstract queue interface
│   └── index.ts
├── events/
│   ├── event-bus.ts             # EventBus (EventEmitter wrapped, typed)
│   ├── event.types.ts           # Tất cả event type definitions
│   └── index.ts
├── memory/
│   ├── memory.service.ts        # Agent memory: short-term, long-term
│   └── index.ts
├── audit/
│   ├── audit.entity.ts
│   ├── audit.service.ts         # Log mọi action với actor, timestamp, payload
│   └── index.ts
└── index.ts                     # Public exports của @familyco/core
```

---

## 4. Cấu Trúc `@familyco/server`

```
packages/server/src/
├── app.ts                       # Fastify app factory
├── main.ts                      # Entry point: server start
├── plugins/
│   ├── auth.plugin.ts           # JWT + API Key auth
│   ├── websocket.plugin.ts      # WebSocket setup
│   ├── prisma.plugin.ts         # Prisma client injection
│   └── cors.plugin.ts
├── modules/
│   ├── agent/
│   │   ├── agent.controller.ts  # Route handlers
│   │   ├── agent.schema.ts      # Zod schemas cho request/response
│   │   └── index.ts
│   ├── task/
│   ├── project/
│   ├── inbox/
│   ├── approval/
│   ├── audit/
│   ├── settings/
│   └── auth/
├── repositories/
│   ├── prisma-agent.repository.ts   # Implements AgentRepository từ core
│   ├── prisma-task.repository.ts
│   ├── prisma-project.repository.ts
│   ├── prisma-inbox.repository.ts
│   └── prisma-audit.repository.ts
├── queue/
│   ├── bullmq-queue.service.ts  # Implements QueueService từ core
│   ├── workers/
│   │   ├── agent-run.worker.ts  # Worker xử lý job AgentRun
│   │   └── tool-call.worker.ts
│   └── index.ts
├── websocket/
│   ├── ws-gateway.ts            # Lắng nghe EventBus → push xuống WS clients
│   └── ws.types.ts
└── tools/
    ├── implementations/
    │   ├── web-search.tool.ts
    │   ├── email-sender.tool.ts
    │   ├── file-reader.tool.ts
    │   ├── task-manager.tool.ts
    │   └── ...
    └── tool-registry.setup.ts   # Đăng ký tất cả tools vào ToolRegistry
```

---

## 5. Cấu Trúc `@familyco/desktop` (Electron)

```
packages/desktop/
├── electron/
│   ├── main.ts                  # Electron main process
│   ├── preload.ts               # contextBridge — expose API lên renderer
│   ├── server-bootstrap.ts      # Khởi động embedded @familyco/server
│   ├── ipc/
│   │   ├── ipc-handlers.ts      # IPC handler: forward calls từ renderer → server
│   │   └── ipc.types.ts         # Typed IPC channel names
│   └── updater.ts               # Auto-update logic
├── electron-vite.config.ts
└── package.json
```

**IPC Pattern:**
```typescript
// renderer (Vue component) — chỉ dùng window.electronAPI
const agents = await window.electronAPI.invoke('agent:list')

// preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: IPCChannel, ...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args)
})

// main process ipc-handlers.ts
ipcMain.handle('agent:list', async () => {
  return fetch('http://localhost:PORT/api/agents').then(r => r.json())
})
```

---

## 6. Cấu Trúc `@familyco/ui` (Vue 3)

```
packages/ui/src/
├── main.ts
├── App.vue
├── router/
│   └── index.ts                 # Hash mode routes
├── stores/                      # Pinia stores
│   ├── agent.store.ts
│   ├── task.store.ts
│   ├── project.store.ts
│   ├── inbox.store.ts
│   ├── approval.store.ts
│   └── app.store.ts             # Global: theme, server mode, connection status
├── api/
│   ├── client.ts                # Axios instance — base URL có thể là localhost hoặc remote
│   ├── agent.api.ts
│   ├── task.api.ts
│   ├── project.api.ts
│   ├── inbox.api.ts
│   └── websocket.ts             # WS client + event handlers
├── layouts/
│   ├── AppLayout.vue            # Sidebar + TopBar + Main content slot
│   └── OnboardingLayout.vue
├── pages/
│   ├── onboarding/
│   │   ├── Step1Provider.vue
│   │   ├── Step2Company.vue
│   │   ├── Step3Preferences.vue
│   │   ├── Step4FirstAgent.vue
│   │   ├── Step5OrgChart.vue
│   │   └── Step6Complete.vue
│   ├── dashboard/
│   │   └── DashboardPage.vue
│   ├── agents/
│   │   ├── AgentListPage.vue
│   │   ├── AgentDetailPage.vue
│   │   └── AgentCreatePage.vue
│   ├── projects/
│   ├── tasks/
│   ├── inbox/
│   ├── command/
│   │   └── CommandCenterPage.vue
│   ├── audit/
│   └── settings/
│       ├── SettingsLayout.vue
│       ├── AIProviderSettings.vue
│       ├── ServerSettings.vue
│       ├── DatabaseSettings.vue
│       └── NotificationSettings.vue
└── components/
    ├── common/                  # Button, Input, Badge, Modal, Drawer, Toast, Skeleton
    ├── agent/                   # AgentCard, AgentStatusBadge, AgentTree, AgentForm
    ├── task/                    # TaskRow, TaskCard, TaskStatusBadge
    ├── inbox/                   # InboxItem, ApprovalCard, MessageThread
    └── dashboard/               # KPICard, ActivityFeed, AgentHealthGrid
```

---

## 7. Database Schema (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = env("DB_PROVIDER")   // "sqlite" | "postgresql" | "mysql"
  url      = env("DATABASE_URL")
}

model Agent {
  id              String    @id @default(cuid())
  name            String
  role            String
  level           Int       // 0=L0, 1=L1, 2=L2
  department      String
  status          String    @default("idle")
  model           String
  systemPrompt    String    @default("")
  temperature     Float     @default(0.7)
  approvalMode    String    @default("suggest_only")
  memoryType      String    @default("short")
  canContactFounder Boolean @default(false)
  parentId        String?
  parent          Agent?    @relation("AgentTree", fields: [parentId], references: [id])
  children        Agent[]   @relation("AgentTree")
  tools           AgentTool[]
  tasks           Task[]    @relation("AssignedAgent")
  messages        Message[]
  auditLogs       AuditLog[]
  createdBy       String    @default("founder")
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  lastActiveAt    DateTime?
  totalTokensUsed Int       @default(0)
}

model AgentTool {
  id       String @id @default(cuid())
  agentId  String
  toolId   String
  agent    Agent  @relation(fields: [agentId], references: [id], onDelete: Cascade)
  @@unique([agentId, toolId])
}

model Project {
  id          String    @id @default(cuid())
  name        String
  description String    @default("")
  status      String    @default("active")
  ownerId     String?   // Agent owner (L0 hoặc L1)
  parentId    String?
  parent      Project?  @relation("ProjectTree", fields: [parentId], references: [id])
  children    Project[] @relation("ProjectTree")
  tasks       Task[]
  createdBy   String    @default("founder")
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deadline    DateTime?
}

model Task {
  id           String    @id @default(cuid())
  title        String
  description  String    @default("")
  status       String    @default("pending")  // pending|in_progress|review|blocked|done|cancelled
  priority     Int       @default(0)
  projectId    String?
  project      Project?  @relation(fields: [projectId], references: [id])
  assignedToId String?
  assignedTo   Agent?    @relation("AssignedAgent", fields: [assignedToId], references: [id])
  parentTaskId String?
  parentTask   Task?     @relation("TaskTree", fields: [parentTaskId], references: [id])
  subtasks     Task[]    @relation("TaskTree")
  createdById  String    // agent_id hoặc "founder"
  blockedReason String?
  approvalId   String?   @unique
  approval     ApprovalRequest? @relation(fields: [approvalId], references: [id])
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  dueAt        DateTime?
  completedAt  DateTime?
}

model Message {
  id          String    @id @default(cuid())
  agentId     String?
  agent       Agent?    @relation(fields: [agentId], references: [id])
  fromType    String    // "founder" | "agent"
  fromId      String    // "founder" hoặc agent id
  toType      String    // "founder" | "agent"
  toId        String
  type        String    // APPROVAL_REQUEST | REPORT | ALERT | SUGGESTION | INFO
  subject     String    @default("")
  body        String
  metadata    String    @default("{}") // JSON string
  read        Boolean   @default(false)
  createdAt   DateTime  @default(now())
}

model ApprovalRequest {
  id          String    @id @default(cuid())
  requesterId String    // agent id
  actionType  String    // "create_agent" | "send_email" | "create_project" | ...
  payload     String    // JSON string — full action payload
  status      String    @default("pending")  // pending|approved|rejected|expired
  reviewNote  String?
  task        Task?
  createdAt   DateTime  @default(now())
  resolvedAt  DateTime?
}

model AuditLog {
  id        String   @id @default(cuid())
  actorType String   // "founder" | "agent"
  actorId   String
  agent     Agent?   @relation(fields: [actorId], references: [id])
  action    String   // "task.created" | "agent.paused" | "approval.approved" | ...
  targetType String?
  targetId  String?
  payload   String   @default("{}") // JSON string
  createdAt DateTime @default(now())
}

model Settings {
  id    String @id @default(cuid())
  key   String @unique
  value String  // JSON string
}

model ApiKey {
  id        String   @id @default(cuid())
  name      String
  keyHash   String   @unique
  lastUsedAt DateTime?
  createdAt DateTime @default(now())
  active    Boolean  @default(true)
}
```

---

## 8. API Routes (REST)

Tất cả routes có prefix `/api/v1`. Auth required trừ `/auth/*`.

### Agents
```
GET    /agents                    # List agents (filter: level, status, dept)
POST   /agents                    # Tạo agent mới (founder only)
GET    /agents/:id                # Agent detail
PATCH  /agents/:id                # Update config
DELETE /agents/:id                # Archive agent
POST   /agents/:id/pause          # Pause
POST   /agents/:id/resume         # Resume
GET    /agents/:id/tasks          # Tasks của agent
GET    /agents/:id/inbox          # Inbox của agent
GET    /agents/tree               # Trả về toàn bộ hierarchy dạng cây
```

### Tasks
```
GET    /tasks                     # List tasks (filter: status, project, agent)
POST   /tasks                     # Tạo task
GET    /tasks/:id
PATCH  /tasks/:id
DELETE /tasks/:id
POST   /tasks/:id/assign          # Assign cho agent
POST   /tasks/:id/unblock         # Unblock task bị blocked
```

### Projects
```
GET    /projects
POST   /projects
GET    /projects/:id
PATCH  /projects/:id
DELETE /projects/:id
GET    /projects/:id/tasks
```

### Inbox
```
GET    /inbox                     # Master inbox của founder
GET    /inbox/:agentId            # Inbox của một agent cụ thể
POST   /inbox/messages            # Gửi message
PATCH  /inbox/messages/:id/read   # Mark as read
```

### Approvals
```
GET    /approvals?status=pending
GET    /approvals/:id
POST   /approvals/:id/approve
POST   /approvals/:id/reject
```

### Audit
```
GET    /audit?actorId=&action=&from=&to=
GET    /audit/:id
```

### Settings
```
GET    /settings
GET    /settings/:key
PUT    /settings/:key
POST   /settings/test-connection  # Test AI provider, DB, email
```

### Auth
```
POST   /auth/api-keys             # Tạo API key
GET    /auth/api-keys
DELETE /auth/api-keys/:id
```

---

## 9. WebSocket Events

Client subscribe tới server qua WS. Server push events khi state thay đổi.

### Server → Client (push)
```typescript
type WSEvent =
  | { type: 'agent.status_changed'; payload: { agentId: string; status: AgentStatus } }
  | { type: 'task.updated'; payload: { taskId: string; status: TaskStatus } }
  | { type: 'task.created'; payload: { task: TaskSummary } }
  | { type: 'approval.requested'; payload: { approvalId: string; actionType: string } }
  | { type: 'message.received'; payload: { messageId: string; from: string; type: MessageType } }
  | { type: 'agent.run.started'; payload: { agentId: string; jobId: string } }
  | { type: 'agent.run.completed'; payload: { agentId: string; jobId: string } }
  | { type: 'agent.run.error'; payload: { agentId: string; error: string } }
  | { type: 'audit.log'; payload: { log: AuditLogSummary } }
```

### Client → Server
```typescript
type WSCommand =
  | { type: 'subscribe'; channels: string[] }   // 'agents', 'tasks', 'inbox', 'audit'
  | { type: 'ping' }
```

---

## 10. Agent Runner — Luồng Xử Lý

Đây là luồng thực thi của một "agent turn" — từ khi nhận job cho đến khi hoàn thành.

```typescript
// packages/core/src/engine/agent-runner.ts

async function runAgentTurn(job: AgentRunJob): Promise<AgentRunResult> {
  const { agentId, input, contextType } = job

  // 1. Load agent profile + memory
  const agent = await agentRepository.findById(agentId)
  const memory = await memoryService.load(agentId)

  // 2. Build system prompt
  const systemPrompt = buildSystemPrompt(agent, memory)

  // 3. Gọi AI với streamText
  const result = await streamText({
    model: getAIModel(agent.model),
    system: systemPrompt,
    messages: memory.recentMessages,
    tools: getAgentTools(agent.tools),      // chỉ tools được cấp phép
    maxSteps: 10,                           // giới hạn tool call loops
    onStepFinish: async ({ toolCalls }) => {
      for (const call of toolCalls) {
        // 4. Mọi tool call đi qua ApprovalGuard trước
        const allowed = await approvalGuard.check({
          agentId,
          toolId: call.toolName,
          payload: call.args,
        })

        if (allowed === 'blocked') {
          // Tạo ApprovalRequest, emit event, dừng lại
          await approvalService.createRequest({ agentId, ...call })
          eventBus.emit('approval.requested', { agentId, toolName: call.toolName })
          throw new ApprovalRequiredError(call.toolName)
        }

        // 5. Thực thi tool qua ToolExecutor
        const toolResult = await toolExecutor.execute(call.toolName, call.args, { agentId })

        // 6. Log vào AuditTrail
        await auditService.log({
          actorType: 'agent',
          actorId: agentId,
          action: `tool.${call.toolName}`,
          payload: { args: call.args, result: toolResult },
        })
      }
    },
  })

  // 7. Lưu memory
  await memoryService.save(agentId, result)

  // 8. Emit completion event
  eventBus.emit('agent.run.completed', { agentId, jobId: job.id })

  return { agentId, output: result.text, toolCallCount: result.steps.length }
}
```

---

## 11. ApprovalGuard — Logic Kiểm Tra

```typescript
// packages/core/src/approval/approval-guard.ts

type CheckResult = 'allowed' | 'suggest' | 'blocked'

async function check(params: {
  agentId: string
  toolId: string
  payload: unknown
}): Promise<CheckResult> {
  const agent = await agentRepository.findById(params.agentId)

  // 1. Kiểm tra override rule riêng cho tool này
  const override = agent.approvalOverrides.find(r => r.toolId === params.toolId)
  const mode = override?.mode ?? agent.approvalMode

  if (mode === 'auto') return 'allowed'
  if (mode === 'require_review') return 'blocked'
  if (mode === 'suggest_only') return 'suggest'

  return 'allowed'
}
```

---

## 12. EventBus — Typed Events

```typescript
// packages/core/src/events/event-bus.ts

import { EventEmitter } from 'node:events'
import type { FamilyCoEvent } from './event.types'

class TypedEventBus extends EventEmitter {
  emit<K extends FamilyCoEvent['type']>(
    event: K,
    payload: Extract<FamilyCoEvent, { type: K }>['payload']
  ): boolean {
    return super.emit(event, payload)
  }

  on<K extends FamilyCoEvent['type']>(
    event: K,
    listener: (payload: Extract<FamilyCoEvent, { type: K }>['payload']) => void
  ): this {
    return super.on(event, listener)
  }
}

export const eventBus = new TypedEventBus()
```

---

## 13. Environment Variables

### Desktop / Server chung
```env
NODE_ENV=development|production
APP_VERSION=1.0.0
```

### Server
```env
PORT=3000
HOST=0.0.0.0

# Database
DB_PROVIDER=sqlite          # sqlite | postgresql | mysql
DATABASE_URL=file:./data/familyco.db

# Redis (cần cho BullMQ — Server Only)
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=change-this-secret
JWT_EXPIRES_IN=7d

# Encryption (cho lưu API keys, sensitive settings)
ENCRYPTION_KEY=32-char-random-string

# Logging
LOG_LEVEL=info              # trace|debug|info|warn|error
LOG_FORMAT=json             # json | pretty
```

### AI Providers (lưu trong DB Settings, không dùng .env trực tiếp)
```
settings.openai_api_key
settings.anthropic_api_key
settings.default_model
settings.default_temperature
```

---

## 14. Quy Ước Code (Conventions)

### Naming
- Files: `kebab-case.ts` — `agent.service.ts`, `approval-guard.ts`
- Classes: `PascalCase` — `AgentService`, `ApprovalGuard`
- Interfaces/Types: `PascalCase` — `AgentProfile`, `AgentRunJob`
- Functions: `camelCase` — `runAgentTurn`, `checkApproval`
- Constants: `SCREAMING_SNAKE_CASE` — `MAX_AGENT_LEVEL`, `DEFAULT_TEMPERATURE`
- Pinia stores: `useXxxStore` — `useAgentStore`, `useInboxStore`
- Vue components: `PascalCase.vue` — `AgentCard.vue`, `ApprovalModal.vue`

### Error Handling
```typescript
// Dùng custom error classes, không throw plain Error
class ApprovalRequiredError extends Error {
  constructor(public toolName: string) {
    super(`Tool "${toolName}" requires approval`)
    this.name = 'ApprovalRequiredError'
  }
}

// API errors phải trả về cấu trúc chuẩn
interface APIError {
  statusCode: number
  code: string        // "AGENT_NOT_FOUND", "APPROVAL_REQUIRED", ...
  message: string
  details?: unknown
}
```

### Vue Component Rules
- Dùng `<script setup lang="ts">` — không dùng Options API
- Props phải có type đầy đủ với `defineProps<{...}>()`
- Không fetch API trực tiếp trong component — gọi qua Pinia store action
- Emit events phải khai báo với `defineEmits<{...}>()`
- Composables đặt trong `composables/` với prefix `use`: `useAgentStatus.ts`

### Pinia Store Pattern
```typescript
// stores/agent.store.ts
export const useAgentStore = defineStore('agent', () => {
  // state
  const agents = ref<Agent[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // getters
  const activeAgents = computed(() => agents.value.filter(a => a.status === 'active'))

  // actions
  async function fetchAgents() {
    loading.value = true
    try {
      agents.value = await agentApi.list()
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  return { agents, loading, error, activeAgents, fetchAgents }
})
```

---

## 15. Testing Strategy

| Layer | Tool | Scope |
|---|---|---|
| Core unit tests | Vitest | Service, Guard, Engine logic |
| API integration | Vitest + supertest | Route handlers, DB queries |
| Vue components | Vitest + Vue Test Utils | Component render, interactions |
| E2E | Playwright | Critical flows: onboarding, agent create, approve |

**Coverage minimum:** Core services 80%, API routes 70%, Vue pages 50%.

---

## 16. Build & Release

### Desktop
```bash
# Dev
pnpm --filter @familyco/desktop dev

# Build
pnpm --filter @familyco/desktop build
# Output: packages/desktop/dist/ → .exe, .dmg, .AppImage
```

### Server Only
```bash
# Dev
pnpm --filter @familyco/server dev

# Build
pnpm --filter @familyco/server build
# Output: packages/server/dist/main.js

# Docker
docker build -f packages/server/Dockerfile -t familyco-server .
```

### Docker Compose (Server Only + Redis + PostgreSQL)
```yaml
# docker-compose.yml
services:
  server:
    image: familyco-server
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/familyco
      REDIS_URL: redis://redis:6379
    depends_on: [db, redis]

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: familyco
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine

volumes:
  pgdata:
```

