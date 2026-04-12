---
description: Đây là file hướng dẫn mặc định. Luôn đọc kỹ và tuân thủ các quy tắc trong file này trước khi thực hiện bất kỳ thay đổi nào.
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

- `.github/docs/02-PRD.md` — hiểu sản phẩm, tính năng, user flow.
- `.github/docs/03-ARCHITECTURE.md` — hiểu kiến trúc tổng thể, các module, layer, và cách chúng tương tác.
- `.github/docs/04-DOMAIN_MODEL.md` — hiểu model dữ liệu, entity, và mối quan hệ.
- `.github/docs/05-MODULE_SPECS.md` — hiểu chi tiết từng module, API contract, và trách nhiệm.
- `.github/docs/06-AGENT_OPERATING_MODEL.md` — hiểu cách Agent hoạt động, phân quyền, và luồng approval.
- `.github/docs/07-APPROVAL_POLICY.md` — hiểu chính sách approval, khi nào cần approval, và cách thức hoạt động.
- `.github/docs/09-CODING_RULES.md` — hiểu quy tắc coding, convention, và best practices cho codebase.

Nếu yêu cầu mới conflict với các file trên, **không tự quyết** → ghi rõ conflict vào comment/PR.

---

## 3. Quy Tắc Kiến Trúc CỐT LÕI (Không Được Vi Phạm)

1. **Business logic chỉ nằm trong `@familyco/core`**  
   - Không đưa logic nghiệp vụ vào Vue component, controller Fastify, hay Electron main.

2. **`core` KHÔNG import package nội bộ nào khác**  
   - Không được tạo import từ `@familyco/server`, `@familyco/ui`, `@familyco/electron`, `@familyco/cli` vào `core`.

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
   - UI runtime (Vue renderer)? → `apps/web/*`  
   - UI contracts/design tokens? → `packages/ui/*`  
   - Electron shell / Desktop? → `apps/electron/*`  
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

## 5. GitNexus Workflow Cho Phân Tích / Tìm Kiếm Code

Khi repo đã được GitNexus index, **ưu tiên dùng GitNexus trước** cho các tác vụ hiểu codebase, tìm execution flow, debug bug, phân tích ảnh hưởng thay đổi và rà consumer của API.

### Ưu tiên dùng GitNexus khi:

1. **Muốn hiểu “flow này chạy như thế nào?”**
   - Dùng `gitnexus_query` để tìm process/execution flow liên quan.
   - Dùng `gitnexus_context` để xem callers/callees của symbol chính.

2. **Muốn biết “sửa chỗ này ảnh hưởng gì?”**
   - Dùng `gitnexus_impact` trước khi sửa shared function/class/method.

3. **Sửa API route / controller / response**
   - Dùng `gitnexus_api_impact` để biết route đang được ai consume, access field nào, có mismatch shape hay không.

4. **Refactor / rename / tách hàm**
   - Dùng `gitnexus_rename` cho rename an toàn.
   - Dùng `gitnexus_detect_changes()` trước khi commit để rà blast radius của diff hiện tại.

### Chỉ dùng grep/read/search trực tiếp khi:
- Cần exact line hoặc snippet cụ thể
- Đọc file nhỏ để sửa nhanh
- Nội dung chưa được GitNexus index hoặc cần xác nhận text literal

Nếu GitNexus báo index stale, chạy `npx gitnexus analyze` ở root repo trước khi tiếp tục.

## 6. Quy Tắc Khi Chỉnh Code Trong VSCode

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

6. **Mọi text UI/UX phải đi qua i18n và luôn cập nhật đủ 2 ngôn ngữ**  
   - Khi sửa hoặc thêm UI trong `apps/web/*` hoặc `packages/ui/*`, không để text user-facing hardcode nếu có thể localize.  
   - Bắt buộc cập nhật cả **English** và **Vietnamese** trong bộ dịch chung hiện hành (hiện tại là `packages/ui/src/i18n/en.ts`, `packages/ui/src/i18n/vi.ts`).  
   - Áp dụng cho: page title, button, label, tooltip, empty/loading/error state, modal, banner, onboarding copy, và microcopy UX.

7. **Luôn chạy test liên quan**  
   - Nếu sửa core: chạy unit test core.  
   - Nếu sửa API: chạy integration test.  
   - Nếu sửa UI: chạy ít nhất unit test component (nếu có) hoặc manual quick test.

8. **Không để file phình quá dài**  
   - Nếu file Vue/TS đã chạm khoảng **220 dòng** mà còn cần thêm logic/UI, phải **dừng và tách ngay**, không đợi Founder nhắc.  
   - Nếu sau khi sửa file vượt khoảng **260 dòng** hoặc ôm hơn 1 trách nhiệm chính, thay đổi **chưa được xem là xong**.  
   - Ưu tiên tách theo hướng: **page → subcomponents/composables/helpers**, **controller → routes/services**, **test lớn → helpers + spec theo domain**.  
   - Trong phần summary/PR, phải nêu rõ file nào đã được tách hoặc lý do cụ thể nếu giữ nguyên.

---

## 7. Quy Trình Git / GitHub Chuẩn Cho AI Agent

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

## 8. Những Điều CẦN HỎI Thay Vì Tự Ý Làm

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

File này là "hợp đồng" giữa kiến trúc FamilyCo và AI Coding Agent. 
Nếu rule nào cần cập nhật, phải được Founder chỉnh trực tiếp.
