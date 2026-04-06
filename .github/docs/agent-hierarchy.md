# Kiến Trúc Agent Hierarchy

> Tech Stack: Electron + Vue 3

---

## 1. Tổng Quan Kiến Trúc

FamilyCo tổ chức agent theo mô hình **cây phân cấp có vai trò** (Hierarchical Role Tree). Founder là điểm quyết định tối cao, bên dưới là Executive Layer (agent cấp cao nhất), tiếp theo là Department Layer và dưới cùng là Specialist Layer. Mỗi tầng có quyền hạn, khả năng tạo artifact và mức độ tự chủ khác nhau.

```
Founder (Human)
  └── Executive Agent (Chief of Staff / CEO Agent)   [L0]
        ├── PM Agent (Project Manager)               [L1]
        │     ├── Task Planner Agent                 [L2]
        │     └── Tracker Agent                      [L2]
        ├── Ops Agent (Operations)                   [L1]
        │     ├── Scheduler Agent                    [L2]
        │     └── Automation Agent                   [L2]
        ├── Research Agent                           [L1]
        │     └── Web Crawler / Summarizer Agent     [L2]
        ├── Finance Agent                            [L1]
        │     └── Report Agent                       [L2]
        └── Marketing Agent                          [L1]
              └── Content Agent                      [L2]
```

---

## 2. Các Tầng Agent (Layers)

### Tầng L0 — Executive Agent (Cấp Cao Nhất)

Executive Agent là "bộ não điều hành" của công ty AI. Đây là agent duy nhất được phép tạo Agent mới theo chỉ thị của Founder.

**Quyền hạn đặc biệt của L0:**
- ✅ Tạo Agent mới (L1, L2) — duy nhất có quyền này
- ✅ Phân công và giải tán Agent
- ✅ Tạo Project và phân công Project cho L1
- ✅ Tạo Task cấp cao, phân rã thành subtask
- ✅ Đọc toàn bộ inbox/log của các agent cấp dưới
- ✅ Gửi báo cáo tổng hợp lên Founder
- ✅ Escalate quyết định vượt quyền lên Founder
- ❌ Không thể tự thay đổi model/tool của chính mình (phải qua Founder)
- ❌ Không thể xóa Agent (phải qua Founder)

**Mức tự chủ mặc định:** Suggest-only với Founder, Auto trong nội bộ các L1.

**Profile mặc định:**
```yaml
name: "Chief of Staff"
level: L0
model: GPT-4o / Claude 3.5 Sonnet (do Founder chọn)
tone: professional, concise
memory: long-term (công ty context, lịch sử quyết định)
tools: [task_manager, project_manager, agent_spawner, report_generator, inbox_reader]
approval_mode: suggest_only   # với Founder
auto_delegate: true           # với L1
```

---

### Tầng L1 — Department Agents (Trưởng Phòng)

Mỗi L1 là "trưởng phòng" của một mảng nghiệp vụ cụ thể. L1 được giao Project, tự phân rã thành Task, và có thể tạo/giao Task cho các L2.

**Quyền hạn chung của tầng L1:**
- ✅ Tạo Task trong phạm vi Project được giao
- ✅ Giao Task cho L2 (nếu có)
- ✅ Tạo Project con (sub-project) trong phạm vi của mình
- ✅ Inbox/chat riêng với Founder và L0
- ✅ Báo cáo tiến độ định kỳ lên L0
- ❌ Không thể tạo Agent
- ❌ Không thể truy cập inbox của agent khác cùng cấp
- ❌ Không thể thay đổi cấu hình AI model của mình

**Bảng các L1 mặc định được đề xuất:**

| Agent | Vai trò | Tools mặc định | Approval mode |
|---|---|---|---|
| PM Agent | Quản lý dự án, timeline, deliverable | task_manager, calendar, file_reader | Suggest-only |
| Ops Agent | Vận hành nội bộ, workflow automation | scheduler, webhook, email_sender | Auto |
| Research Agent | Thu thập thông tin, phân tích, summarize | web_search, url_reader, summarizer | Suggest-only |
| Finance Agent | Theo dõi chi phí, dự báo, báo cáo tài chính | spreadsheet, calculator, report_gen | Require-review |
| Marketing Agent | Chiến lược content, SEO, social media | content_gen, social_api, seo_tool | Suggest-only |

---

### Tầng L2 — Specialist Agents (Chuyên Viên)

L2 là "nhân viên thực thi" tập trung vào một nhiệm vụ hẹp và lặp lại. Chúng không có inbox trực tiếp với Founder; mọi giao tiếp đi qua L1.

**Quyền hạn của tầng L2:**
- ✅ Nhận và thực thi Task
- ✅ Tạo sub-task trong Task đang xử lý
- ✅ Báo cáo kết quả lên L1
- ✅ Chat với L1 (không có inbox riêng với Founder)
- ❌ Không thể tạo Task ngoài phạm vi được giao
- ❌ Không thể tạo Project
- ❌ Không thể tạo Agent
- ❌ Không thể giao tiếp trực tiếp với Founder (trừ trường hợp L1 forward)

**Approval mode mặc định:** Auto (hầu hết thao tác), Require-review với các thao tác có side-effect bên ngoài (gửi email, publish content, gọi API ngoài).

---

## 3. Cơ Chế Approval (3 Chế Độ)

FamilyCo hỗ trợ 3 mức kiểm soát, có thể thiết lập riêng cho từng Agent, từng loại Action, hoặc từng Project.

### Auto
Agent tự thực hiện không cần hỏi. Log lại hành động vào Audit Trail.
- **Áp dụng cho:** Tạo task nội bộ, tóm tắt, báo cáo định kỳ, phân công công việc nội bộ.
- **Rollback:** Founder có thể undo trong vòng 60 phút qua Audit Trail.

### Suggest-only
Agent đề xuất hành động, Founder hoặc L0 xem xét và click Approve/Reject.
- **Áp dụng cho:** Tạo agent con, tạo project mới, thay đổi kế hoạch, đề xuất ngân sách.
- **UX:** Hiện notification trong Inbox; nếu Founder không xử lý sau X giờ, agent có thể escalate hoặc tự block.

### Require-review
Agent dừng hoàn toàn, chờ Founder phê duyệt mới tiếp tục. Có thể yêu cầu thêm thông tin.
- **Áp dụng cho:** Gửi email ra ngoài, publish nội dung, truy cập file nhạy cảm, gọi API có phí, xóa dữ liệu.
- **UX:** Task chuyển sang trạng thái `BLOCKED — Awaiting Approval`, có modal chi tiết để Founder xem context đầy đủ trước khi quyết định.

**Bảng tóm tắt:**

| Chế độ | Agent dừng lại? | Founder nhận thông báo? | Có thể override? |
|---|---|---|---|
| Auto | Không | Sau khi xong (optional) | Undo trong 60 phút |
| Suggest-only | Có (chờ approve) | Ngay lập tức | Approve / Reject / Modify |
| Require-review | Có (hard block) | Ngay lập tức (priority) | Approve / Reject / Request more info |

---

## 4. Agent Profile — Data Model

Mỗi agent trong FamilyCo là một entity đầy đủ với các thuộc tính sau:

```typescript
interface AgentProfile {
  // Identity
  id: string;
  name: string;
  avatar: string;          // auto-generated hoặc do Founder đặt
  role: string;            // "Chief of Staff", "PM Agent", v.v.
  level: "L0" | "L1" | "L2";
  department: string;      // "Executive", "Engineering", "Marketing", v.v.
  status: "active" | "idle" | "paused" | "archived";

  // AI Configuration
  model: string;           // "gpt-4o", "claude-3-5-sonnet", v.v.
  systemPrompt: string;    // prompt hệ thống tùy chỉnh
  temperature: number;
  maxTokensPerRun: number;
  tools: ToolID[];         // danh sách tool được cấp phép

  // Hierarchy
  parentAgentId: string | null;   // null nếu là L0
  childAgentIds: string[];        // danh sách agent con

  // Memory
  memoryType: "short" | "long" | "persistent";
  contextWindowSize: number;
  knowledgeBaseIds: string[];     // file, URL, document được cấp phép đọc

  // Governance
  approvalMode: "auto" | "suggest_only" | "require_review";
  approvalOverrides: ApprovalOverride[];  // rule riêng cho từng action type

  // Communication
  inboxEnabled: boolean;
  canContactFounder: boolean;     // true chỉ với L0 và L1
  notificationChannels: string[]; // email, in-app, v.v.

  // Metadata
  createdAt: Date;
  createdBy: "founder" | "L0_agent";
  lastActiveAt: Date;
  totalTasksCompleted: number;
  totalTokensUsed: number;
}
```

---

## 5. Luồng Tạo Agent

### 5a. Founder tạo trực tiếp (qua Admin Panel)
```
Founder mở Settings > Agent Management > New Agent
  → Chọn Level (L0 / L1 / L2)
  → Chọn Parent Agent (ai quản lý agent này)
  → Điền Role, Department, Model, Tools
  → Thiết lập Approval Mode
  → Save → Agent được kích hoạt
```

### 5b. L0 Agent đề xuất tạo Agent mới (Suggest-only)
```
L0 phân tích workload hoặc nhận chỉ thị của Founder
  → L0 sinh AgentSuggestion {role, level, tools, rationale}
  → Gửi lên Founder Inbox (Suggest-only notification)
  → Founder xem, chỉnh sửa nếu cần, Approve
  → Hệ thống tự tạo agent từ template L0 đề xuất
  → L0 nhận agent mới vào cây hierarchy
```

### 5c. Founder ra chỉ thị tự nhiên (Command Center)
```
Founder: "Tạo cho tôi một agent để viết blog post hàng tuần"
  → L0 phân tích intent
  → L0 sinh đề xuất: Content Writer Agent (L2, dưới Marketing Agent)
  → Suggest-only notification → Founder approve
  → Agent được tạo và gán vào Marketing Agent
```

---

## 6. Luồng Tạo Project và Task

### Project Creation
- **Founder** có thể tạo Project trực tiếp từ Command Center hoặc Projects tab.
- **L0 Agent** có thể đề xuất Project (suggest-only).
- **L1 Agent** có thể tạo sub-project trong Project đã được giao.
- **L2 Agent** không thể tạo Project.

### Task Creation
- **Mọi agent** có thể tạo Task trong phạm vi Project/sub-project mình phụ trách.
- **L0** có thể tạo Task ở bất kỳ Project nào.
- **L1** chỉ tạo Task trong Project được phân công.
- **L2** chỉ tạo sub-task trong Task đang xử lý.
- Task do agent tạo cần log `createdBy: agent_id` và gắn với `projectId`.

### Task Lifecycle
```
PENDING → IN_PROGRESS → REVIEW → DONE
                ↓
           BLOCKED (approval required)
                ↓
           CANCELLED
```

---

## 7. Inbox / Chat Architecture

Mỗi agent (L0 và L1) có inbox riêng. Founder có Master Inbox tổng hợp tất cả.

```
Founder
  ├── Master Inbox (tổng hợp: approve/reject, alerts, reports)
  └── Direct Chat với từng Agent (L0, L1)

L0 Executive Agent
  ├── Inbox từ Founder
  ├── Inbox tổng hợp từ tất cả L1
  └── Direct Chat với từng L1

L1 Department Agent
  ├── Inbox từ L0
  ├── Inbox tổng hợp từ các L2 mình quản lý
  └── (KHÔNG có direct chat với Founder)

L2 Specialist Agent
  ├── Inbox từ L1 quản lý mình
  └── Không có inbox độc lập
```

**Message Types trong Inbox:**
- `APPROVAL_REQUEST` — cần Founder/L0 phê duyệt
- `REPORT` — báo cáo định kỳ hoặc kết quả task
- `ALERT` — cảnh báo: task bị chặn, lỗi, vượt ngân sách token
- `SUGGESTION` — đề xuất (agent mới, project, thay đổi kế hoạch)
- `INFO` — cập nhật thông tin không cần hành động

---

## 8. Quyền Hạn — Ma Trận Tóm Tắt

| Hành động | Founder | L0 Agent | L1 Agent | L2 Agent |
|---|---|---|---|---|
| Tạo Agent | ✅ | ✅ (suggest→approve) | ❌ | ❌ |
| Xóa Agent | ✅ | ❌ | ❌ | ❌ |
| Tạo Project | ✅ | ✅ | Sub-project only | ❌ |
| Tạo Task | ✅ | ✅ | Trong Project của mình | Sub-task only |
| Chat với Founder | — | ✅ | ✅ (qua L0 inbox) | ❌ |
| Thay đổi model/tools | ✅ | ❌ | ❌ | ❌ |
| Đọc Audit Log | ✅ | ✅ (toàn bộ) | Của mình | Của mình |
| Gọi External API | ✅ | Require-review | Require-review | Require-review |
| Publish/Send ra ngoài | ✅ | Require-review | Require-review | Require-review |

---

## 9. Trạng Thái Agent

| Status | Mô tả | Action của Founder |
|---|---|---|
| `active` | Đang nhận và xử lý task bình thường | Pause / Archive |
| `idle` | Không có task, đang chờ | Assign task / Archive |
| `paused` | Bị tạm dừng bởi Founder | Resume / Archive |
| `busy` | Đang xử lý task, không nhận thêm | Xem task hiện tại |
| `blocked` | Dừng do chờ approval | Approve / Reject |
| `error` | Gặp lỗi không tự xử lý được | Xem log / Retry / Fix config |
| `archived` | Không còn hoạt động, dữ liệu vẫn lưu | Restore / Delete |

---

## 10. Thiết Kế UX — Agent Management (Admin Panel)

### Màn hình Agent List
- **View mặc định:** Table view (admin panel style) — tên, level, status, model, tasks đang xử lý.
- **Secondary view:** Tree view (org chart) để visualize hierarchy.
- **Filter:** Theo level, status, department, model.
- **Quick actions:** Pause, Archive, View Inbox, View Tasks — không cần mở detail page.

### Màn hình Agent Detail
Chia làm 4 tab:
1. **Overview** — thông tin cơ bản, status, stats (tasks completed, tokens used, uptime).
2. **Configuration** — model, temperature, system prompt, tools, approval mode.
3. **Tasks** — danh sách task đang xử lý, completed, blocked.
4. **Inbox/Chat** — giao tiếp trực tiếp với agent này.

### Tạo Agent (Create Agent Form)
- Wizard 4 bước ngắn:
  1. **Role & Level** — tên, vai trò, chọn level (L0/L1/L2), chọn parent agent.
  2. **AI Config** — model, temperature, system prompt (có template mẫu).
  3. **Tools & Permissions** — chọn tools, thiết lập approval mode, quyền truy cập KB.
  4. **Review & Activate** — preview đầy đủ trước khi tạo.

---

## 11. Phụ Lục — Danh Sách Tools Chuẩn

| Tool ID | Mô tả | Cần approval? |
|---|---|---|
| `task_manager` | Tạo/sửa/xóa task | Auto |
| `project_manager` | Tạo/sửa project | Suggest-only |
| `agent_spawner` | Đề xuất tạo agent mới | Suggest-only (chỉ L0) |
| `web_search` | Tìm kiếm internet | Auto |
| `url_reader` | Đọc nội dung URL | Auto |
| `file_reader` | Đọc file nội bộ | Auto |
| `file_writer` | Ghi file nội bộ | Suggest-only |
| `email_sender` | Gửi email | Require-review |
| `calendar` | Đọc/ghi lịch | Suggest-only |
| `report_generator` | Tạo báo cáo | Auto |
| `spreadsheet` | Đọc/ghi spreadsheet | Suggest-only |
| `webhook` | Gọi webhook bên ngoài | Require-review |
| `content_gen` | Tạo nội dung văn bản | Auto |
| `social_api` | Đăng lên social media | Require-review |
| `summarizer` | Tóm tắt document/URL | Auto |
| `code_runner` | Chạy code (sandbox) | Require-review |
| `database_query` | Query DB nội bộ | Suggest-only |


---

## 12. Kiến Trúc 2 Phiên Bản (Desktop & Server Only)

FamilyCo được phân phối dưới **2 distribution mode** phục vụ hai nhu cầu khác nhau nhưng chia sẻ cùng một core engine.

---

### 12a. Desktop Edition (Phiên bản chính)

**Mục tiêu:** All-in-one, Founder chỉ cần cài một app là dùng được ngay.

**Cách hoạt động:**
- Electron shell bọc một **embedded server** (Node.js) chạy ngầm trong process con.
- Embedded server xử lý toàn bộ logic agent, queue, DB, AI API calls.
- Vue 3 UI kết nối với embedded server qua `localhost` (HTTP/WebSocket).
- Khi tắt app → embedded server dừng theo.

**Kiến trúc nội bộ Desktop:**
```
┌─────────────────────────────────────────────────────┐
│  Electron Shell                                     │
│  ┌───────────────────┐  ┌───────────────────────┐  │
│  │  Vue 3 Renderer   │  │  Embedded Server       │  │
│  │  (Main UI)        │◄─►  (Node.js process)    │  │
│  │                   │  │  - Agent Engine        │  │
│  │  - Dashboard      │  │  - Task Queue          │  │
│  │  - Agent Manager  │  │  - AI API Client       │  │
│  │  - Command Center │  │  - DB (SQLite file)    │  │
│  │  - Settings       │  │  - WebSocket Server    │  │
│  └───────────────────┘  └───────────────────────┘  │
│                 localhost:PORT                       │
└─────────────────────────────────────────────────────┘
         │
         ▼
  External AI APIs (OpenAI, Claude, ...)
```

**Đặc điểm:**
| Thuộc tính | Chi tiết |
|---|---|
| Installer | `.exe` (Windows), `.dmg` (macOS), `.AppImage` (Linux) |
| DB mặc định | SQLite (file tại `userData/familyco.db`, tự động được quản lý) |
| Data storage | Local machine, full privacy |
| Update | Auto-update qua Electron updater |
| Kết nối Server Only | Có — Founder có thể trỏ Desktop UI sang Server Only host riêng |
| Offline mode | Có (task queue, UI hoạt động); AI calls cần internet |

---

### 12b. Server Only Edition (Phiên bản headless)

**Mục tiêu:** Dành cho người muốn đặt engine FamilyCo trên VPS/server riêng, truy cập từ Desktop app hoặc bất kỳ HTTP client nào.

**Cách hoạt động:**
- Là Node.js process thuần túy, không có Electron, không có UI.
- Khởi động và cấu hình qua **console / CLI**.
- Expose REST API + WebSocket để Desktop Edition hoặc bất kỳ UI client nào kết nối vào.
- Chạy 24/7 như một service (pm2, systemd, Docker).

**Kiến trúc Server Only:**
```
┌──────────────────────────────────────────┐
│  FamilyCo Server (Node.js / headless)    │
│                                          │
│  - Agent Engine                          │
│  - Task Queue (Bull / BullMQ)            │
│  - AI API Client                         │
│  - REST API  (Express / Fastify)         │
│  - WebSocket Server                      │
│  - DB Adapter (SQLite / PostgreSQL)      │
│  - CLI Config Interface                  │
└──────────────────────────────────────────┘
       ▲               ▲
       │               │
  Desktop App     Any HTTP Client
  (Vue 3 UI)      (browser, curl, ...)
```

**CLI commands mẫu:**
```bash
# Khởi động server
familyco-server start --port 3000 --db postgres://...

# Xem trạng thái agents đang chạy
familyco-server status

# Tạo API key cho Desktop app kết nối
familyco-server auth create-key --name "My Desktop"

# Xem log real-time
familyco-server logs --follow

# Backup toàn bộ data
familyco-server backup --output ./backup.tar.gz
```

**Đặc điểm:**
| Thuộc tính | Chi tiết |
|---|---|
| Deployment | VPS, Docker, bare metal, Raspberry Pi |
| Config | `.env` file + CLI flags |
| DB | SQLite (mặc định) hoặc PostgreSQL (Server Only edition) |
| Auth | API Key + JWT; có thể bật IP whitelist |
| Process manager | PM2, systemd, Docker Compose |
| Resource | Nhẹ, ~80-150MB RAM khi idle |
| Logs | Structured JSON log, tương thích với Grafana/Loki |

---

### 12c. Kết Nối Desktop → Server Only

Desktop Edition có thể hoạt động theo 2 mode:

```
Mode 1: Local (default)
  Desktop UI ──► Embedded Server (localhost)

Mode 2: Remote
  Desktop UI ──► Remote Server Only (VPS via HTTPS + WS)
```

Khi chuyển sang Remote mode, Settings > Server Connection cho phép:
- Nhập Server URL (`https://your-vps.com:3000`)
- Nhập API Key
- Test Connection
- Switch Server (có thể lưu nhiều server profile)

Điều này giúp Founder dùng Desktop app trên máy tính cá nhân nhưng engine chạy 24/7 trên VPS — agent vẫn hoạt động khi máy tính tắt.

---

### 12d. Shared Core — Code Architecture

Cả 2 phiên bản đều dùng chung **`@familyco/core`** package, tách biệt hoàn toàn với transport layer:

```
packages/
  @familyco/core/         ← Business logic, Agent Engine, Queue, DB Adapter
  @familyco/server/       ← Express/Fastify server, WebSocket, REST API
  @familyco/desktop/      ← Electron shell + embedded server bootstrap
  @familyco/ui/           ← Vue 3 frontend (dùng cho Desktop)
  @familyco/cli/          ← CLI interface cho Server Only
```

**Monorepo approach (pnpm workspaces)** cho phép:
- Desktop = `@familyco/core` + `@familyco/server` + `@familyco/ui` + `@familyco/desktop`
- Server Only = `@familyco/core` + `@familyco/server` + `@familyco/cli`
- Core không phụ thuộc vào Electron hay Vue — có thể test độc lập.

---

### 12e. So Sánh 2 Phiên Bản

| Tiêu chí | Desktop Edition | Server Only |
|---|---|---|
| **Target user** | Founder muốn cài & dùng ngay | Dev/founder muốn tự host |
| **UI** | Vue 3 đầy đủ | Không có (dùng Desktop kết nối vào) |
| **Setup** | Cài app, xong | Cài Node, config .env, chạy server |
| **Chạy 24/7** | Không (chỉ khi app mở) | Có (service) |
| **Multi-client** | 1 client (local only) | Nhiều client cùng kết nối |
| **Resource** | Máy cá nhân | VPS/server |
| **Privacy** | Data trên máy mình | Data trên server mình host |
| **Update** | Auto-update | Manual (npm / Docker pull) |
| **Phù hợp** | Dùng ngay, cá nhân | Scale, automation, headless |

