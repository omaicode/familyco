# Tổng Quan Dự Án

> Mục tiêu tài liệu: giúp hiểu rõ bối cảnh sản phẩm, vai trò người dùng, phạm vi tính năng và nguyên tắc thiết kế trước khi sinh code hay đề xuất kiến trúc.

---

## 1. Mục Tiêu Sản Phẩm

FamilyCo là một **AI-native company operating system** cho Founder: một nền tảng nơi Founder đưa ra mục tiêu, chỉ thị và ràng buộc, còn các AI Agent vận hành như một "công ty nhỏ" với vai trò, trách nhiệm và luồng phối hợp rõ ràng.

- Founder **không làm việc như nhân viên** mà chỉ **đưa ra chỉ thị và ra quyết định** ở các điểm quan trọng.
- Hệ thống AI Agents đảm nhiệm phần còn lại: phân tích, lập kế hoạch, tạo task/project, báo cáo, xin duyệt và thực thi.
- UX ưu tiên: **dễ hiểu, dễ setup, dễ quan sát** hơn là quá nhiều tùy chọn phức tạp.

Sản phẩm có 2 distribution mode:

1. **Desktop Edition (Electron + Vue 3)** — phiên bản chính, all-in-one, Founder cài và dùng trực tiếp.
2. **Server Only Edition (Node.js headless)** — chạy trên VPS/server riêng, Desktop UI kết nối từ xa.

Khi sinh code hoặc đề xuất thay đổi, AI Agent phải luôn đảm bảo **2 phiên bản dùng chung core** và không phá vỡ tính tương thích giữa chúng.

---

## 2. Đối Tượng Người Dùng & Bối Cảnh

- Người dùng chính: **Founder/Owner** của một công ty nhỏ hoặc solo founder.
- Nhu cầu chính:
  - Muốn **AI vận hành như đội nhân viên** cho công ty (Ops, PM, Finance, Marketing, Research).
  - Muốn **tập trung vào quyết định và chiến lược**, không phải chi tiết thực thi.
  - Muốn có **một dashboard trung tâm** theo dõi toàn bộ hoạt động của "công ty AI".

Ngoài Founder, có các Agent (L0, L1, L2) nhưng tất cả đều là entity **AI**, không có người dùng thứ hai. Không cần thiết kế multi-tenant phức tạp giai đoạn đầu.

---

## 3. Mô Hình Agent Hierarchy (Tóm Tắt)

FamilyCo tổ chức Agent theo mô hình 3 tầng (L0 → L1 → L2):

- **L0 — Executive Agent (Chief of Staff / CEO Agent)**
  - Là "bộ não điều hành" của công ty AI.
  - **Duy nhất** có quyền đề xuất tạo Agent mới (dưới dạng Suggest-only, Founder phải approve).
  - Có quyền tạo Project, phân công Project cho L1, đọc tổng quan inbox và log của các Agent dưới.

- **L1 — Department Agents (Trưởng Phòng)**
  - Mỗi Agent phụ trách một mảng: PM, Ops, Research, Finance, Marketing, v.v.
  - Được phép tạo Task, sub-project trong phạm vi được giao, giao việc cho L2.
  - Có inbox/chat riêng với L0 (và gián tiếp với Founder qua L0).

- **L2 — Specialist Agents (Chuyên Viên)**
  - Thực thi nhiệm vụ hẹp, lặp lại: viết content, crawl web, tính toán, lập báo cáo.
  - Không được tạo Agent, không được tạo Project, chỉ tạo sub-task trong Task đang xử lý.
  - Không có direct chat với Founder, chỉ qua L1.

AI Agent khi đọc tài liệu khác (Agent Hierarchy, Technical Architecture) phải **không tự ý thay đổi quy tắc role & permission** trừ khi có yêu cầu rõ ràng từ Founder.

> Trạng thái mặc định sau onboarding là **chỉ có 1 Agent L0**. Các vai trò L1/L2 ban đầu chỉ tồn tại như **template** để L0 đề xuất sau này khi Founder thấy cần.

---

## 4. Các Khối Chức Năng Chính

### 4.1 Executive Chat

- Kênh hội thoại chính nơi Founder chat trực tiếp với **L0 Executive Agent**.
- Dùng để hỏi đáp, brainstorm, xin đề xuất, hoặc yêu cầu hệ thống thực sự làm một việc cụ thể.
- Chat không bắt buộc luôn tạo Task, nhưng khi Founder muốn execution rõ ràng thì L0 sẽ chuyển yêu cầu thành Task hoặc Approval phù hợp.

### 4.2 Dashboard

- Hiển thị health tổng thể của "công ty AI".
- Tập trung vào 5–7 KPI rõ ràng: số task trong ngày, task blocked, số approval pending, trạng thái Agent, token usage, v.v.
- Chỉ có **một vùng cuộn chính** (không nested scroll) để dễ đọc.

### 4.3 Agent Management

- Danh sách Agent dưới dạng bảng (admin panel) + tree view (org chart).
- Xem chi tiết Agent: cấu hình model, tools, approval mode, thống kê, và health của heartbeat gần nhất.
- Tạo/Pause/Terminate Agent theo wizard chuẩn; Agent mới thường được đề xuất bởi L0 và Founder phê duyệt.
- Agents được mô hình hóa như “AI employees” chạy theo từng heartbeat ngắn. UI nên giải thích execution model và session persistence theo dạng on-demand info/modal, không chiếm chỗ thường trực trên trang.

### 4.4 Project & Task Management

- Project: container lớn cho mục tiêu cụ thể, có owner Agent (L0 hoặc L1).
- Task: đơn vị công việc nhỏ hơn, có trạng thái lifecycle: `pending → in_progress → review → done` (+ `blocked`, `cancelled`).
- Agent ở các level có quyền khác nhau về việc tạo project/task (L0 full, L1 trong phạm vi, L2 chỉ sub-task).

### 4.5 Inbox / Approvals

- **Master Inbox** cho Founder: tập trung tất cả `APPROVAL_REQUEST`, `ALERT`, `REPORT`, `SUGGESTION`, `INFO`.
- Mỗi Agent cũng có inbox riêng (trừ L2 chỉ nhận từ L1).
- Approval flow sử dụng 3 chế độ: `auto`, `suggest_only`, `require_review`.

### 4.6 Settings & Integrations

- AI Providers (OpenAI, Claude, v.v.).
- Email, Webhook, Notification.
- Kết nối với Server Only (nếu Founder dùng server remote).

AI Agent không được tự ý mở rộng scope (ví dụ thêm CRM, HR, Billing) nếu Founder chưa yêu cầu.

---

## 5. Luồng Onboarding (Wizard)

Onboarding là trải nghiệm quan trọng đầu tiên; mục tiêu là **tạo được 1 L0 Agent + đề xuất org chart ban đầu** càng nhanh càng tốt.

1. **Welcome** — giới thiệu ngắn: "FamilyCo giúp bạn điều hành một công ty AI với nhiều Agent chuyên trách".
2. **Company Profile** — tên công ty, ngành, quy mô, mục tiêu 90 ngày.
3. **AI Provider Setup** — chọn provider, nhập API key, test connection, chọn default model.
4. **Finish** — đưa Founder đến Dashboard hiển thị Tour Guide.

AI Agent khi thay đổi frontend/back-end liên quan onboarding phải giữ logic 4 bước này, chỉ được thay đổi wording/UX nhỏ trừ khi có yêu cầu khác.

---

## 6. Nguyên Tắc UX/UI Cho AI Agent

Khi đề xuất UI hoặc sửa code Vue/Electron, AI Agent phải tuân thủ các nguyên tắc sau:

1. **Clarity over Cleverness** — ưu tiên rõ ràng, ít bất ngờ, wording đơn giản.
2. **Một hành động chính mỗi màn hình** — luôn làm nổi bật Primary Action (CTA) rõ ràng.
3. **Progressive Disclosure** — options nâng cao ẩn sau nút "Advanced" hoặc tab riêng; tránh form dài quá nhiều field.
4. **Ý nghĩa ánh xạ với kiến trúc Agent** — mọi nút/phần giao diện liên quan Agent đều bám sát Agent Hierarchy (L0, L1, L2, approval mode).
5. **State đầy đủ** — loading dùng skeleton, empty state có hướng dẫn, error state có hành động sửa.

AI Agent không nên:
- Tự thêm animation phức tạp, gradient, hay UI "flashy" nếu không có yêu cầu.
- Thay đổi hierarchy, tên role, hoặc logic approval mà không có instruction.

---

## 7. Ranh Giới & Phiên Bản

- Giai đoạn hiện tại: **Single Founder, Single Tenant**; không xây multi-user auth phức tạp.
- Không hỗ trợ mobile app native; chỉ có Desktop (Electron) và Server headless.
- Không triển khai chat real-time đa người; message chỉ giữa Founder và Agents.

Nếu Founder muốn mở rộng (ví dụ thêm nhiều human user, client portal), sẽ được mô tả trong tài liệu mới; AI Agent **không tự suy diễn** từ phiên bản hiện tại.

---

Tài liệu này là **nguồn sự thật cấp cao (high-level truth)**; các tài liệu như *Agent Hierarchy* và *Technical Architecture* là nguồn sự thật chi tiết (low-level truth). Khi có mâu thuẫn, hỏi Founder, không tự phân xử.