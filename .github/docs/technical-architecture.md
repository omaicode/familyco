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
| ORM | Prisma | 7.x — Schema-first, type-safe |
| DB mặc định | SQLite (file-based, không cần server) | `prisma/dev.db` dev, `userData/familyco.db` Electron |
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
├── apps/
│   ├── renderer/                # @familyco/renderer (Vue 3 runtime)
│   └── desktop/                 # @familyco/desktop (Electron shell)
├── packages/
│   ├── core/                    # @familyco/core
│   ├── server/                  # @familyco/server
│   ├── ui/                      # @familyco/ui (UI contracts/theme/store abstractions)
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
@familyco/renderer  →  @familyco/ui + @familyco/core (contracts/types)
@familyco/desktop   →  @familyco/server + @familyco/renderer
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
│   ├── agent.service.ts         # Business logic: create, update, pause, terminate
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
apps/desktop/src/
├── electron/
│   ├── main.ts                  # Electron main process
│   ├── preload.ts               # contextBridge — expose API lên renderer
│   ├── server-bootstrap.ts      # Khởi động embedded @familyco/server
│   ├── ipc/
│   │   ├── ipc-handlers.ts      # IPC handler: forward calls từ renderer → server
│   │   └── ipc.types.ts         # Typed IPC channel names
│   └── smoke.ts                 # Smoke validation for embedded startup
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

## 6. Cấu Trúc `@familyco/renderer` (Vue 3)

```
apps/renderer/src/
├── main.ts
├── App.vue
├── router.ts                    # Hash mode routes
├── runtime.ts                   # Runtime bootstrap using @familyco/ui contracts
├── views/
│   ├── DashboardPage.vue
│   ├── AgentsPage.vue
│   ├── InboxPage.vue
│   └── PlaceholderPage.vue
└── styles.css
```

`@familyco/ui` continues to host shared UI contracts, tokens, and store abstractions consumed by renderer.

---

## 7. Database Schema (Prisma)

> Schema chính: `prisma/schema.prisma`  
> Migration: `pnpm prisma:migrate:dev` (tạo file SQL trong `prisma/migrations/`)

Database engine: **SQLite** (file-based, không cần server riêng).  
- Dev: `prisma/dev.db` (đặt `DATABASE_URL=file:./prisma/dev.db` trong `.env`)
- Electron Desktop: `<OS userData>/familyco.db` — được set tự động qua `process.env.DATABASE_URL` trong `main.ts` trước khi Prisma khởi tạo.

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  // url được cấu hình trong prisma.config.ts (không khai báo trong schema)
}

model Agent {
  id            String   @id @default(cuid())
  name          String
  role          String
  level         String
  department    String
  status        String
  parentAgentId String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  parent   Agent?  @relation("AgentHierarchy", fields: [parentAgentId], references: [id])
  children Agent[] @relation("AgentHierarchy")
}

model Project {
  id              String   @id @default(cuid())
  name            String
  description     String
  ownerAgentId    String
  parentProjectId String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  owner         Agent    @relation("ProjectOwner", fields: [ownerAgentId], references: [id])
  parentProject Project? @relation("ProjectTree", fields: [parentProjectId], references: [id])
  subProjects   Project[] @relation("ProjectTree")
  tasks         Task[]
}

model Task {
  id              String   @id @default(cuid())
  title           String
  description     String
  status          String
  projectId       String
  assigneeAgentId String?
  createdBy       String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  project  Project @relation(fields: [projectId], references: [id])
  assignee Agent?  @relation("TaskAssignee", fields: [assigneeAgentId], references: [id])
  creator  Agent   @relation("TaskCreator", fields: [createdBy], references: [id])
}

model ApprovalRequest {
  id        String   @id @default(cuid())
  actorId   String
  action    String
  targetId  String?
  status    String
  payload   String?  // JSON
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  actor Agent @relation("ApprovalActor", fields: [actorId], references: [id])
}

// AuditLog không có FK trên actorId (cho phép actor "system")
model AuditLog {
  id        String   @id @default(cuid())
  actorId   String
  action    String
  targetId  String?
  payload   String?  // JSON
  createdAt DateTime @default(now())
}

model Settings {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String   // JSON
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ApiKey {
  id        String   @id @default(cuid())
  name      String
  keyHash   String   @unique
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## 8. API Routes (REST)

Tất cả routes có prefix `/api/v1`. Auth required trừ `/auth/*`.

### Agents
```
GET    /agents                    # List agents (filter: level, status, dept)
POST   /agents                    # Tạo agent mới (founder only)
POST   /agents/:id/pause          # Pause agent
GET    /agents/:id/children       # Direct reports của agent
GET    /agents/:id/path           # Chuỗi reporting line từ L0 -> agent
PATCH  /agents/:id/parent         # Cập nhật manager / reporting line
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
PORT=4000
HOST=0.0.0.0
API_PREFIX=/api/v1
```

### Storage / Database
```env
# Driver: 'prisma' (SQLite) hoặc 'memory' (in-process, mất khi restart)
FAMILYCO_REPOSITORY_DRIVER=prisma

# SQLite file path — dùng khi FAMILYCO_REPOSITORY_DRIVER=prisma
# Dev:      DATABASE_URL=file:./prisma/dev.db
# Electron: set tự động trong main.ts → file://<userData>/familyco.db
DATABASE_URL=file:./prisma/dev.db
```

### Queue
```env
# 'memory' (mặc định) hoặc 'bullmq' (cần Redis — Server Only)
FAMILYCO_QUEUE_DRIVER=memory
REDIS_URL=redis://127.0.0.1:6379
FAMILYCO_QUEUE_NAME=familyco-jobs
ENABLE_QUEUE_WORKERS=0
```

> **Hiện trạng runtime (2026-04-08):**
> - Background worker chỉ thực sự xử lý async jobs khi `FAMILYCO_QUEUE_DRIVER=bullmq` **và** `ENABLE_QUEUE_WORKERS=1`.
> - Với queue driver `memory` mặc định, jobs được giữ trong process để test/dev và **không có scheduler heartbeat định kỳ** tự đánh thức agent.
> - Setting `agent.defaultHeartbeatMinutes` hiện mới là cấu hình UI/settings; chưa có recurring scheduler phía server dùng setting này để wake agents tự động.
> - `AgentRunner` hiện lưu context ngắn hạn qua `InMemoryMemoryService`; chưa có adapter-level session serialization/restoration bền vững qua restart process.
> - Kết quả mỗi lượt chạy hiện được ghi qua `AuditLog` + inbox reports; chưa có bảng `AgentRunRecord` chuyên biệt.

### Auth & Security
```env
# ⚠️ Đổi tất cả default này thành random string trong production
FAMILYCO_API_KEY=local-dev-api-key
JWT_SECRET=local-dev-secret
API_KEY_SALT=local-dev-salt
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
# Output: apps/desktop/dist/ → desktop runtime bundle
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

### Docker Compose (Server Only + Redis)
```yaml
# docker-compose.yml
services:
  server:
    image: familyco-server
    ports: ["4000:4000"]
    environment:
      NODE_ENV: production
      DATABASE_URL: file:/data/familyco.db
      FAMILYCO_REPOSITORY_DRIVER: prisma
      REDIS_URL: redis://redis:6379
    volumes:
      - dbdata:/data
    depends_on: [redis]

  redis:
    image: redis:7-alpine

volumes:
  dbdata:
```

