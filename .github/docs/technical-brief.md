# Cấu Trúc Kỹ Thuật (Phiên bản tóm tắt)

> Mục tiêu tài liệu: cung cấp bản tóm tắt kỹ thuật đủ chi tiết để AI Agent sinh code đúng kiến trúc, không phá vỡ structure.

---

## 1. Nguyên Tắc Vàng Khi Sinh Code

1. **Không đưa business logic vào UI** — mọi xử lý Agent/Task/Project phải nằm trong `@familyco/core`.
2. **Không import Electron trong `core` hoặc `server`** — Electron chỉ tồn tại trong `@familyco/electron`.
3. **Không gọi AI provider trực tiếp từ Vue/Electron/Controller** — tất cả đi qua Engine (`agent-runner` + `tool-executor`) trong `core`.
4. **Mọi action có side-effect (email, webhook, DB mutation lớn) phải đi qua `ApprovalGuard`**.
5. **Tất cả query DB đi qua Repository** — không dùng Prisma client trực tiếp trong service hoặc controller.
6. **Không dùng `any`** — TypeScript strict, không tắt strict mode.
7. **Không thay đổi schema Prisma tùy tiện** — nếu cần, mô tả diff rõ ràng.
8. **Không thêm route API mới trùng ý nghĩa với route cũ** — tái dùng pattern, đặt tên nhất quán.
9. **Không thêm dependency nặng nếu chưa có lý do** — ưu tiên libs đã dùng (Fastify, Prisma, Vite, Pinia).
10. **Nếu không chắc, dừng và hỏi** — tốt hơn là sinh code sai kiến trúc.

---

## 2. Monorepo & Dependency Graph

Cấu trúc:

```
familyco/
  apps/
    renderer/   → @familyco/web (Vue 3 frontend runtime)
    desktop/    → @familyco/electron (Electron shell + embedded server)
  packages/
    core/       → @familyco/core (business logic)
    server/     → @familyco/server (Fastify API + queue + WS)
    ui/         → @familyco/ui (UI contracts, theme tokens, stores)
    cli/        → @familyco/cli (Server Only console)
```

Quan hệ phụ thuộc (bắt buộc):

- `@familyco/core`: **không** import package nội bộ nào.
- `@familyco/server` → import `@familyco/core`.
- `@familyco/ui` → cung cấp UI contracts/theme/store abstractions.
- `@familyco/web` → dùng `@familyco/ui` + API runtime Vue.
- `@familyco/electron` → wrap `@familyco/server` + `@familyco/web` + Electron.
- `@familyco/cli` → dùng `@familyco/server` hoặc trực tiếp `@familyco/core`.

AI Agent khi tạo file mới phải đặt đúng package, đúng layer.

---

## 3. `@familyco/core` — Các Module Chính

Trong `packages/core/src/` có các module:

- `agent/` — AgentProfile, AgentService, AgentRepository (abstract)
- `task/` — Task entity/service/repository
- `project/` — Project entity/service/repository
- `inbox/` — Message entity/service/repository
- `approval/` — ApprovalGuard, ApprovalService
- `engine/` — AgentRunner, ToolExecutor, ToolRegistry
- `queue/` — QueueService (abstract), Job types
- `events/` — EventBus typed
- `memory/` — MemoryService (short/long-term)
- `audit/` — AuditService + Audit entity

**Nguyên tắc:**
- Service chỉ gọi **repository interface**, không gọi DB trực tiếp.
- Engine (AgentRunner) chỉ dùng **public API** của AgentService/TaskService, không đụng repository.
- EventBus là trung tâm publish/subcribe để các layer khác (server, websocket) lắng nghe.

---

## 4. `@familyco/server` — API & Queue

- Framework: **Fastify**.
- Auth: JWT + API Keys.
- ORM: Prisma.
- Queue: In-memory queue service (concurrent lanes per job type).
- WS: `@fastify/websocket`.

### 4.1 Modules

Mỗi module (agent, task, project, inbox, approval, audit, settings, auth) có cấu trúc:

```
modules/agent/
  agent.controller.ts   # định nghĩa routes
  agent.schema.ts       # Zod schema cho validate
  index.ts              # register routes
```

Repositories Prisma implement interfaces từ `core`:

```
repositories/prisma-agent.repository.ts  → implements AgentRepository
```

### 4.2 Patterns Quan Trọng

- Controller **không chứa business logic**: nhận request → validate → gọi service ở `core` → map kết quả sang DTO.
- Mọi `POST`/`PATCH` dữ liệu quan trọng phải log vào `AuditService`.
- Khi Agent/Task/Approval thay đổi state, server publish event lên EventBus, WS gateway đẩy xuống client.

---

## 5. `@familyco/web` — Vue 3 Admin Panel Runtime

- Framework: Vue 3 + `<script setup>`.
- State: Pinia.
- Router: Vue Router (hash mode).
- UI Style: Tailwind CSS + CSS variables.

### 5.1 Patterns

- Không fetch API trực tiếp trong component phức tạp; gọi qua Pinia store.
- Các page trong `pages/*` dùng layout `AppLayout` (Sidebar + TopBar + Main).
- Sử dụng component nhỏ: `AgentCard`, `TaskRow`, `InboxItem`, `KPICard`, v.v.
- Loading state: skeleton components (`SkeletonCard`, `SkeletonTableRow`).
- Empty state: component có icon + message + primary action.

### 5.2 API Client

- Dùng 1 `api/client.ts` với base URL cấu hình được (local server hoặc remote server).
- Dùng Axios hoặc Fetch wrapper; **không** nhúng URL string trực tiếp khắp nơi.

---

## 6. `@familyco/ui` — UI Contracts & Theme Package

- Chứa contracts, route metadata, theme tokens, css-variable helpers, store abstractions.
- Không chứa runtime Electron hoặc app bootstrapping.
- Được dùng bởi `@familyco/web` để render UI nhất quán.

---

## 7. `@familyco/electron` — Electron Shell

- Main process khởi động:
  1. Fastify server embedded (sử dụng code từ `@familyco/server`).
  2. Electron BrowserWindow trỏ vào UI runtime từ `@familyco/web`.
- Preload script expose API sau qua `contextBridge`:
  - `invoke(channel, ...args)` → IPC từ renderer đến main.
  - `on(channel, handler)` → subscribe event.

Renderer (Vue) **không được** import `electron` trực tiếp; chỉ dùng `window.electronAPI` đã được type.

---

## 8. Database — Bảng Cần Ghi Nhớ

Database engine: **SQLite** (file-based, không cần server riêng).  
ORM: **Prisma 7** — schema tại `prisma/schema.prisma`, migrate bằng `pnpm prisma:migrate:dev`.

- Dev DB: `prisma/dev.db` (`DATABASE_URL=file:./prisma/dev.db` trong `.env`)
- Electron Desktop: `<OS userData>/familyco.db` (set tự động trong `apps/desktop/src/electron/main.ts`)

Repository driver (`FAMILYCO_REPOSITORY_DRIVER`): `prisma` (mặc định) hoặc `memory` (chỉ dùng cho test).

Các model hiện có — AI Agent **không được** tạo thêm bảng mới khi chưa được approval:

- `Agent` — thông tin Agent + hierarchy (tự tham chiếu qua `parentAgentId`).
- `Project` — project + tree project con (qua `parentProjectId`).
- `Task` — task với assignee + người tạo + project.
- `ApprovalRequest` — approval flow (actor, action, status, payload JSON).
- `AuditLog` — audit trail (không có FK trên `actorId` để cho phép actor "system").
- `Settings` — key-value JSON (AI keys, config).
- `ApiKey` — API keys cho server.

Khi cần lưu thêm dữ liệu mới, ưu tiên **mở rộng `payload` dạng JSON string** trước khi tạo bảng mới.

---

## 9. API Naming & Error Format

- Prefix tất cả routes bằng `/api/v1`.
- Dùng danh từ số nhiều: `/agents`, `/projects`, `/tasks`, `/inbox`, `/approvals`, `/audit`, `/settings`.
- Hành động con dùng POST: `/agents/:id/pause`, `/tasks/:id/assign`.

Error JSON chuẩn:

```json
{
  "statusCode": 400,
  "code": "TASK_INVALID_STATUS",
  "message": "Task status transition not allowed",
  "details": {"from": "done", "to": "in_progress"}
}
```

AI Agent phải tái dùng format này, **không tạo kiểu error JSON mới**.

---

## 10. Agent Runner & ApprovalGuard (High-Level)

- `AgentRunner` nhận job: `{ agentId, input, contextType }`.
- Load Agent + memory, build system prompt, gọi AI qua Vercel AI SDK với tool-calling.
- Mỗi khi AI gọi tool: **ApprovalGuard.check** → nếu cần review, tạo `ApprovalRequest` + emit event + dừng.
- Nếu được phép, `ToolExecutor.execute` thực thi tool tương ứng, log vào `AuditService`.
- Runtime nền hiện hỗ trợ queued/on-demand agent runs **và** heartbeat scheduler định kỳ từ server; session context được lưu qua settings store để heartbeat sau có thể tiếp tục mà không đọc lại toàn bộ thread.
- Queue runtime chạy song song theo lane độc lập (`agent.run`, `tool.execute`) với concurrency giới hạn theo lane; mặc định tự scale theo CPU và có thể override qua env.
- `GET /health` đã trả queue metrics (`total/queued/running/completed/failed` + breakdown theo lane) để theo dõi ổn định khi tải cao.

AI Agent **không được** bypass ApprovalGuard hoặc call ToolExecutor trực tiếp từ ngoài Engine.

---

## 11. Cách AI Agent Nên Làm Khi Thêm Tính Năng

1. Xác định layer:
   - Logic nghiệp vụ mới → `@familyco/core`.
   - API mới → thêm route trong `@familyco/server` dùng service của `core`.
   - UI mới → thêm page/component trong `@familyco/ui`.
   - Chỉ liên quan Electron (window, menu, updater) → `@familyco/electron`.

2. Kiểm tra xem đã có service/model phù hợp chưa; nếu có, **mở rộng** thay vì tạo cái mới trùng ý nghĩa.

3. Nếu cần sửa DB:
   - Đề xuất thay đổi schema (Prisma) dưới dạng diff.
   - Đảm bảo migration không phá dữ liệu cũ.

4. Luôn update test tương ứng (unit/integration/UI) khi thêm logic mới.

5. Nếu thay đổi ảnh hưởng đến nhiều package, mô tả rõ:
   - Files bị ảnh hưởng.
   - Các bước migration.
   - Cách rollback nếu cần.
  - Kết quả load test / benchmark (nếu thay đổi liên quan queue, scheduler, hoặc throughput).

---

## 11. Khi Gặp Mâu Thuẫn Giữa Tài Liệu

Nguồn ưu tiên:
1. **Yêu cầu mới nhất từ Founder (chat hiện tại)**.
2. **Tài liệu Tổng Quan Dự Án (Overview)**.
3. **Tài liệu Kiến Trúc Kỹ Thuật chi tiết**.
4. Tài liệu cũ hơn.

Nếu phát hiện mâu thuẫn (ví dụ schema cũ khác mô tả mới): **không tự quyết**; phải nêu rõ mâu thuẫn và chờ Founder chỉnh.