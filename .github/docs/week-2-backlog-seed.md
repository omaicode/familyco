# Week 2 Backlog Seed

This backlog seed captures the first expansion batch after week-1 MVP vertical demo.

## 1. Dashboard KPI Depth

- Add persisted KPI aggregation endpoints for daily/weekly views.
- Add trend cards for task throughput, blocked ratio, and approval latency.
- Add filtering by agent level and department.

## 2. Onboarding 7-Step Completion

- Implement multi-step onboarding wizard in renderer with progress persistence.
- Add provider connection test action and error guidance copy.
- Add suggested org chart acceptance flow from L0 proposals.

## 3. Queue & Worker Depth

- Add retry strategy tuning by job type.
- Add dead-letter queue visibility endpoint for failed jobs.
- Add worker lifecycle audit events for start/fail/retry/success.

## 4. WebSocket Event Stream

- Add WS gateway module in server to stream EventBus updates to renderer.
- Add renderer event subscription store for live dashboard updates.
- Add reconnect strategy with backoff and connection-state UI.

## 5. Test Coverage Expansion

- Add API integration tests for engine queue lifecycle and auth edge cases.
- Add renderer component tests for dashboard, agents, and inbox flows.
- Add desktop smoke automation to CI for embedded server startup and renderer reachability.
