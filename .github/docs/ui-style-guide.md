# UI Style Guide

> Mục tiêu: định nghĩa rõ cách thiết kế UI/UX cho FamilyCo để khi sinh code Vue/Tailwind không lệch khỏi thiết kế tổng thể.

---

## 1. Triết Lý Thiết Kế

FamilyCo là **web app / admin panel** dạng dashboard, không phải landing page marketing.

Các nguyên tắc cốt lõi:

1. **Product-first, không màu mè**  
   - Nền trung tính, 1 màu accent chính.  
   - Không gradient loè loẹt, không blob neon, không hero marketing.

2. **Clarity over Cleverness**  
   - Wording ngắn, rõ ràng.  
   - Icon chỉ hỗ trợ, text mới là chính.  
   - Một primary action rõ ràng mỗi màn hình.

3. **Hierarchy rõ ràng**  
   - Page title > section header > card title > body text.  
   - Trạng thái, badge, label phân biệt được bằng màu và typography.

4. **State đầy đủ**  
   - Loading: skeleton, không spinner trắng trang.  
   - Empty: có giải thích + CTA.  
   - Error: message rõ ràng + cách sửa.

5. **Một vùng cuộn chính**  
   - Sidebar fixed, header sticky, phần content chính cuộn.  
   - Tránh nested scroll (panel trong panel) trừ khi thực sự cần.

---

## 2. Layout & Navigation

### 2.1 Chia Layout

Dùng cấu trúc 3 phần:

- **Sidebar (trái)**: điều hướng chính (Dashboard, Chat, Agents, Projects, Tasks, Inbox, Audit, Settings).
- **Topbar (trên)**: breadcrumb, search, quick actions (New, Filter), avatar Founder.
- **Main Content**: phần view chính thay đổi theo route.

Pattern:

```vue
<!-- AppLayout.vue (simplified) -->
<template>
  <div class="min-h-screen flex bg-surface text-text">
    <Sidebar />
    <div class="flex-1 flex flex-col">
      <Topbar />
      <main class="flex-1 overflow-y-auto px-6 py-4">
        <RouterView />
      </main>
    </div>
  </div>
</template>
```

### 2.2 Grid & Spacing

- Sử dụng **grid 12 cột** cho dashboard và view nhiều panel.
- Spacing theo scale 4px: 4, 8, 12, 16, 24, 32, 40, 48, 64…
- Thường dùng:
  - `gap-4` (16px) giữa card.  
  - `px-6 py-4` (24x16px) cho section.  
  - `p-4` (16px) cho card.

### 2.3 Responsive

- Mobile-first, nhưng ưu tiên desktop 1280+ vì là admin tool.  
- Dưới 768px: sidebar thu gọn thành off-canvas, topbar vẫn giữ.

---

## 3. Màu Sắc & Theme

### 3.1 Palette

Dùng palette trung tính + accent:

- Background: tông beige/trắng ấm (bg, surface, surface-muted).
- Text: đen xám (text-main, text-muted, text-faint).
- Primary: teal/xanh dịu (cho button chính, link, highlight quan trọng).
- Semantic: green (success), yellow/orange (warning), red (error), blue (info).

**Không dùng:**
- Gradient tím / neon.  
- Nền đen full cho app (có dark mode nhưng vẫn giữ style restraint).

### 3.2 Sử Dụng Màu

- Accent primary **chỉ** cho:
  - Primary button.  
  - Link quan trọng.  
  - Badge trạng thái tích cực.

- Không dùng quá 2 màu accent trong cùng một màn hình.
- Border: dùng màu `border-muted` (xám nhạt, opacity ~10–12%), không dùng đen 100%.

---

## 4. Typography

### 4.1 Font & Size

- Body: sans-serif hiện đại, dễ đọc.  
- Page Title: 24–32px, font-weight semibold/bold.  
- Section Title: 18–20px.  
- Body: 14–16px.  
- Caption/label: 12–13px.

**Quy tắc:**

- Không dùng display font to quá (40–60px) như landing page.
- Không dùng quá 3–4 size chữ trong một màn hình.
- Hạn chế chữ in hoa toàn bộ (chỉ dùng cho label nhỏ, badge).

### 4.2 Alignment

- Text body: **left-aligned**.  
- Chỉ center ở: empty state, hero message đầu trang dashboard (nếu có).

---

## 5. Components Chuẩn

### 5.1 Button

Loại:

- Primary: màu accent, dùng cho hành động chính.
- Secondary: border + text main, nền trong suốt hoặc surface.
- Ghost/Tertiary: text-muted, dùng cho action phụ.

Tailwind ví dụ:

```html
<button
  class="inline-flex items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium
         transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
         disabled:opacity-50 disabled:cursor-not-allowed
         bg-primary text-primary-foreground hover:bg-primary-dark"
>
  Create agent
</button>
```

Quy tắc:
- Không dùng outline button màu đậm trừ khi thật cần.  
- Không dùng icon-only button mà không có tooltip/aria-label.

### 5.2 Card

Dùng card cho panel trong dashboard, danh sách tóm tắt, block cấu hình.

- Corner: `rounded-lg` (8–10px), consistent toàn hệ thống.
- Border: `border border-border-subtle` (xám nhạt).  
- Shadow: nhẹ (`shadow-sm`) hoặc không.

Structure:

```html
<div class="bg-surface rounded-lg border border-border-subtle p-4 flex flex-col gap-2">
  <div class="flex items-center justify-between gap-2">
    <h3 class="text-sm font-medium text-text">Active agents</h3>
    <Badge status="success">OK</Badge>
  </div>
  <p class="text-2xl font-semibold text-text">12</p>
  <p class="text-xs text-text-muted">Updated 2 min ago</p>
</div>
```

### 5.3 Table / List

- Table dùng cho dữ liệu có nhiều cột: Agents, Tasks, Approvals, Audit.
- List/card view dùng cho màn hình hẹp hoặc mobile.

Quy tắc:
- Header bold, background hơi khác (surface-muted).  
- Row height tối thiểu 40–44px.  
- Trạng thái (status) dùng badge/bubble màu.

---

## 6. Patterns UI Cho FamilyCo

### 6.1 Dashboard

- 1 hàng trên cùng: KPI cards (4–6 card nhỏ).  
- Dưới: 2 cột chính:  
  - Trái: task/approval/inbox summary.  
  - Phải: agent activity, token usage.

Không nhét quá nhiều chart phức tạp; ưu tiên list dễ scan.

### 6.2 Agent List & Detail

**Agent List:**
- Table với cột: Name, Role, Level, Status, Model, Last active, Actions.  
- Filter theo: Level, Status, Department.

**Agent Detail:** chia tab:

1. Overview — info chung, stats.  
2. Configuration — model, tools, approval mode.  
3. Tasks — danh sách task liên quan.  
4. Inbox — message thread với agent.

### 6.3 Inbox & Approvals

- Master Inbox dạng list (sidebar trái): mỗi item có icon theo type (Approval, Alert, Report…).  
- Pane phải: chi tiết message + action button (Approve / Reject / View task).

Tránh thiết kế giống email client full; giữ đơn giản, tập trung vào hành động.

### 6.4 Settings

- Sử dụng layout 2 cột:  
  - Sidebar nhỏ list category (AI Provider, Database, Server, Notifications…).  
  - Pane phải chứa form tương ứng.

- Forms chia thành section với tiêu đề nhỏ; không dồn 1 form dài bất tận.

---

## 7. UX Microcopy & Label

- Ngắn, cụ thể, không marketing:
  - "Create agent", "Pause agent", "View tasks", "Test connection".  
  - Tránh: "Supercharge your workflow", "Unlock the power of…".

- Error message:
  - Nói rõ cái gì sai + gợi ý sửa:  
    - "Cannot move task from done to in progress"  
    - "API key is invalid or expired".

- Empty state:
  - 1 câu mô tả + 1 CTA + 1 mô tả ngắn:  
    - "No agents yet" / "Create your first agent to start your AI company".

---

## 8. Loading, Empty, Error States

### 8.1 Loading

- Dùng skeleton thay vì spinner:
  - Skeleton card, skeleton table row, skeleton avatar.
- Skeleton màu gần với surface, chuyển động shimmer nhẹ.

### 8.2 Empty

- Mỗi list view phải có empty state với:
  - Icon/illustration nhẹ.  
  - 1–2 dòng text.  
  - Button tạo mới (Create agent/project/task…).

### 8.3 Error

- Error inline gần chỗ người dùng tương tác.  
- Với lỗi global (server down) → banner top hoặc modal.

---

## 9. Interaction & State

- Hover: subtle (change background/border, không animation mạnh).
- Focus: rõ ràng (outline, ring) để hỗ trợ keyboard navigation.
- Active: feedback nhanh (nhấn button hơi tối đi, table row highlight khi click).
- Không dùng animation phức tạp (spring, bounce) trừ khi có lý do.

---

## 10. Những Điều AI Agent KHÔNG Được Làm Trong UI

1. **Không:**
   - Tự thêm gradient background, blob, glassmorphism cho vui.  
   - Dùng màu sắc chói (neon, bão hòa cao).  
   - Dùng hero section kiểu marketing (full height, big headline 60px).

2. **Không:**
   - Đổi cấu trúc layout AppLayout (Sidebar + Topbar + Main) nếu không có yêu cầu rõ.  
   - Chuyển sang multi-scroll (sidebar riêng cuộn, content riêng cuộn) trừ khi đã thiết kế.

3. **Không:**
   - Đổi tên route chính: `/dashboard`, `/agents`, `/projects`, `/tasks`, `/inbox`, `/settings`, `/audit`, `/command`.

4. **Không:**
   - Gắn quá nhiều icon; icon phải hỗ trợ text, không thay thế text.

---

## 11. Cách Áp Dụng Style Guide Này

Khi sinh code UI (Vue + Tailwind):

1. Kiểm tra xem component/màn hình thuộc loại nào (Dashboard, List, Detail, Settings…).
2. Áp dụng layout và pattern tương ứng mô tả ở trên.
3. Dùng class Tailwind nhất quán với spacing, radius, typography đã nêu.
4. Nếu cần thêm component generic (Badge, Card, Skeleton), tạo ở `components/common` và tái sử dụng.
5. Nếu có đề xuất phá vỡ pattern (ví dụ layout mới, style mới), ghi rõ trong PR/comment thay vì tự đổi tất cả.

Style guide này là **khung UI**; nếu Founder cập nhật thiết kế (vd: Figma mới), file này sẽ được cập nhật theo.

