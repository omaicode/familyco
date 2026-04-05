# UI Release Checklist (MVP Production)

Muc tieu: gate phat hanh giao dien chinh thuc cho FamilyCo Desktop-first.

## 1. Environment Readiness
- `NODE_ENV=production` khi chay release build.
- Da set day du bien trong `.env.production` (tham khao `/.env.production.example`).
- Khong dung gia tri local dev cho `JWT_SECRET`, `API_KEY_SALT`, `FAMILYCO_API_KEY`.
- `VITE_API_BASE_URL` duoc cau hinh ro rang cho renderer production.

## 2. Build + Type Safety
- Chay tai root: `pnpm build`.
- Chay tai root: `pnpm typecheck`.
- Bao dam khong co loi TypeScript o `apps/renderer`, `apps/desktop`, `packages/ui`, `packages/server`.

## 3. Test Gate
- Chay tai root: `pnpm test`.
- Chay them desktop smoke: `pnpm --filter @familyco/desktop smoke`.
- Xac nhan smoke pass voi thong diep "health + api routes are ready".

## 4. Runtime UX Gate
- Vao Dashboard va xac nhan load thanh cong.
- Ngat server tam thoi va xac nhan hien warning "Server is unreachable" + nut `Reconnect`.
- Bat lai server va xac nhan trang thai ve `Connected`.
- Kiem tra Global error banner co nut `Retry` va khong lam trang trang bi treo.

## 5. Responsive + Theme Sanity
- Kiem tra giao dien o 360px, 768px, 1024px va desktop.
- Khong co horizontal scroll ngoai y muon.
- Sidebar/topbar van dieu huong duoc tren kich thuoc nho.
- Kiem tra cac trang uu tien: Dashboard, Inbox, Audit, Settings.

## 6. Release Record
- Ghi ro commit SHA, ngay release, va moi thay doi quan trong.
- Neu co known issue, ghi ro scope anh huong va workaround.
