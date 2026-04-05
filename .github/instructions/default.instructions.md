---
description: Đây là file hướng dẫn mặc định cho AI Agent khi làm việc với codebase. Nó chứa các quy tắc, quy trình, và best practices mà AI cần tuân theo khi chỉnh sửa code, tạo PR, và tương tác với GitHub. File này được thiết kế để đảm bảo mọi thay đổi do AI thực hiện đều phù hợp với kiến trúc và convention của dự án FamilyCo.
applyTo: '**/*'
---

## 1. Vai Trò Của Bạn

Bạn **không phải kiến trúc sư**, bạn là **người thực thi theo kiến trúc đã có**.

- Tập trung: triển khai code, test, refactor nhỏ, fix bug, đi theo tài liệu hiện có.
- Không tự ý: đổi kiến trúc, đổi flow nghiệp vụ, thêm module lớn, đổi tech stack, hoặc phá vỡ convention.
- Khi thấy kiến trúc chưa hợp lý: mô tả vấn đề + đề xuất trong comment/PR, **không tự đổi**.
---

## 2. Tài Liệu BẮT BUỘC Phải Đọc Trước

Trước khi làm bất kỳ thay đổi nào, **phải đọc (hoặc refresh)** các file sau trong repo:

1. `project-overview.md` (`.github/docs/project-overview.md`)
   → Hiểu mục tiêu sản phẩm, đối tượng user, Agent hierarchy, luồng onboarding.

2. `technical-brief.md` (`.github/docs/technical-brief.md`)
   → Hiểu monorepo structure, dependency graph, layer nào làm gì.

3. `technical-architecture.md` (`.github/docs/technical-architecture.md`)
   → Chi tiết module, schema Prisma, API routes, AgentRunner, ApprovalGuard, EventBus.

4. `agent-hierarchy.md` (`.github/docs/agent-hierarchy.md`)
   → Quy tắc L0/L1/L2, quyền hạn, approval mode, inbox.

5. `ui-style-guide.md` (`.github/docs/ui-style-guide.md`)
   → Quy tắc thiết kế UI, naming convention, component structure.

Nếu yêu cầu mới conflict với các file trên, **không tự quyết** → ghi rõ conflict vào comment/PR.

---

## 3. Quy Tắc Kiến Trúc CỐT LÕI (Không Được Vi Phạm)

1. **Business logic chỉ nằm trong `@familyco/core`**  
   - Không đưa logic nghiệp vụ vào Vue component, controller Fastify, hay Electron main.

2. **`core` KHÔNG import package nội bộ nào khác**  
   - Không được tạo import từ `@familyco/server`, `@familyco/ui`, `@familyco/desktop`, `@familyco/cli` vào `core`.

3. **Tất cả gọi AI provider phải qua Engine (`agent-runner` + `tool-executor`)**  
   - Không dùng SDK OpenAI/Anthropic trực tiếp trong UI/Server.

4. **Mọi side-effect (email, webhook, publish ra ngoài, DB mutation lớn) phải đi qua `ApprovalGuard`**.

5. **DB chỉ truy cập qua Repository**  
   - Service dùng interface repository từ `core`.  
   - Implementation Prisma nằm bên `@familyco/server/repositories/*`.

6. **Không bật tắt strict mode**  
   - Không dùng `any` bừa bãi, không chỉnh `tsconfig` để tắt strict.

7. **Không đổi schema Prisma nếu chưa được mô tả rõ diff**  
   - Nếu bắt buộc phải đổi: viết rõ diff + migration step trong PR.

8. **Không thêm package nặng nếu không có lý do**  
   - Ưu tiên libs đã dùng (Fastify, Prisma, BullMQ, Pinia, Vite, Tailwind).

---

## 4. Trình Tự Làm Việc Trước Khi Viết Code

Khi nhận một yêu cầu (issue / task / prompt), hãy đi theo checklist sau **trong đầu** trước khi bắt tay vào code:

1. **Xác định loại yêu cầu**  
   - Bugfix? New API? Mở rộng UI? Thêm field DB? Thay đổi Agent logic?  
   - Ghi rõ loại trong phần mô tả PR / comment đầu tiên.

2. **Xác định layer bị ảnh hưởng**  
   - Logic core? → `packages/core/*`  
   - API/REST/WS? → `packages/server/*`  
   - UI (Vue)? → `packages/ui/*`  
   - Electron shell / Desktop? → `packages/desktop/*`  
   - CLI / Server Only? → `packages/cli/*`

3. **Đọc lại tài liệu liên quan**  
   - Nếu đụng đến Agent/Task/Project/Inbox/Approval: đọc section tương ứng trong `technical-architecture.md` + `agent-hierarchy.md`.

4. **Lập kế hoạch thay đổi nhỏ (Implementation Plan)**  
   - Viết checklist ngắn trong comment/PR, ví dụ:
     - [ ] Thêm field `xyz` vào model `Task` (Prisma + core entity).
     - [ ] Update `TaskService` để xử lý logic mới.
     - [ ] Expose field qua API `/tasks` (controller + schema).
     - [ ] Update UI `TaskRow.vue` hiển thị field.
     - [ ] Thêm test unit/integration.

5. **Xác nhận không phá dependency graph**  
   - Kiểm tra lại imports: `core` không được import từ package khác; `ui` không import `server` hoặc `desktop`.

6. **Sau khi chắc chắn plan ổn, mới bắt đầu chỉnh code**.

---

## 5. Quy Tắc Khi Chỉnh Code Trong VSCode

Khi đang ở trong VSCode (hoặc bất kỳ editor nào) với AI assistance:

1. **Không auto-format toàn file**  
   - Chỉ format vùng code mình đụng tới (giảm diff noise trong PR).

2. **Tuân thủ convention hiện tại**  
   - Tên file, tên class, tên function, casing… theo tài liệu kỹ thuật (`technical-brief.md`).

3. **Không xoá TODO / FIXME trừ khi thực sự giải quyết**  
   - Nếu fix TODO/FIXME: update comment/issue tương ứng.

4. **Không đổi tên public API / route / event** nếu không được yêu cầu rõ ràng.

5. **Không thêm log debug thừa**  
   - Log mới phải có ý nghĩa, dùng logger chuẩn (Pino), không `console.log` lung tung.

6. **Luôn chạy test liên quan**  
   - Nếu sửa core: chạy unit test core.  
   - Nếu sửa API: chạy integration test.  
   - Nếu sửa UI: chạy ít nhất unit test component (nếu có) hoặc manual quick test.

---

## 6. Quy Trình Git / GitHub Chuẩn Cho AI Agent

### 6.1 Branch Naming

Khi tạo branch mới, dùng format:

- `feat/<short-description>` — thêm tính năng.  
  Ví dụ: `feat/agent-inbox-filter`, `feat/dashboard-kpis`.
- `fix/<short-description>` — sửa bug.  
  Ví dụ: `fix/task-status-transition`.
- `chore/<short-description>` — dọn code, update deps.  
  Ví dụ: `chore/update-prisma`.

### 6.2 Commit Message

Dùng dạng ngắn gọn, rõ ràng, tiếng Anh hoặc tiếng Việt đều được nhưng phải nhất quán.

Ví dụ:

- `feat: add approval status filter for tasks`
- `fix: prevent task moving from done back to in_progress`
- `chore: bump fastify to v5`

Không gộp nhiều loại thay đổi lớn trong một commit.

### 6.3 Pull Request Checklist

Trước khi coi PR là "xong" (dù là AI tạo), hãy đảm bảo:

- [ ] Đã link tới issue / yêu cầu tương ứng.
- [ ] Đã ghi **Implementation Plan** ngắn ở phần mô tả PR.
- [ ] Đã liệt kê rõ: files/areas bị ảnh hưởng.
- [ ] Đã chạy test cần thiết và ghi rõ kết quả (ví dụ: "Core unit tests: passed").
- [ ] Đã kiểm tra nhanh UI (nếu có thay đổi UI) ở ít nhất 2 màn hình: Desktop size & small width.
- [ ] Không có thay đổi `.env.example`, `tsconfig`, `package.json` trừ khi yêu cầu.

---

## 7. Những Điều CẦN HỎI Thay Vì Tự Ý Làm

Nếu rơi vào một trong các trường hợp dưới đây, **dừng lại và yêu cầu clarification từ Founder**, không tự implement:

1. Cần thêm **model/bảng DB mới** không được nhắc trong tài liệu.
2. Cần thay đổi **luồng approval** (Auto / Suggest-only / Require-review) mặc định.
3. Cần thêm **loại Agent mới** (ví dụ L3, role mới chưa định nghĩa).
4. Cần thay đổi **luồng onboarding** (thêm/bớt bước).
5. Cần đổi **tech stack lớn** (ORM khác, HTTP framework khác, UI framework khác).
6. Cần **xóa mã cũ** với logic chưa rõ mục đích.

Khi hỏi, hãy mô tả:
- Bối cảnh (file/module liên quan).  
- Vấn đề hoặc giới hạn kiến trúc hiện tại.  
- 1–2 phương án đề xuất.

---

## 8. Cách Sử Dụng File Này

- Trong GitHub: gắn file này trong repo (ví dụ `/.github/AI_AGENT_INSTRUCTIONS.md`) và refer tới nó trong README/CONTRIBUTING.
- Trong VSCode:  
  - Cho AI đọc file này trước (paste vào system prompt hoặc context của extension).  
  - Khi AI đề xuất code không đúng các rule trên → chỉnh prompt hoặc reject suggestion.

File này là "hợp đồng" giữa kiến trúc FamilyCo và AI Coding Agent. 
Nếu rule nào cần cập nhật, phải được Founder chỉnh trực tiếp.
