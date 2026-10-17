# Instructions for autonomous coding agents

Work on HandoffGlass as an **MCP desktop handoff infrastructure** project—not as an autonomous GUI-clicker. Read `docs/AGENT_HANDOFF.md` first.

## Non-negotiable invariants
1. Never invent UI coordinates, approve a payment, grant a permission, or bypass authentication; the human decides.
2. `completed` means **user-reported completion**, not independently verified downstream success. Preserve `verified=false`.
3. Broker must stay loopback-only, bearer authenticated and client-owner scoped. No browser CORS, public listener, or cross-client cancellation.
4. Never silently add screen capture, OCR, accessibility enumeration, cloud calls, or telemetry. Explicit opt-in, privacy and retention design are prerequisites.
5. If the GUI is unavailable, return a real failure instead of pretending an overlay was drawn.
6. Preserve existing six public MCP tools unless introducing a documented, versioned change.
7. Tests must not manipulate a real user's login, security, or payment dialogs.

## Working agreement
- Inspect `src/core.mjs`, `src/bridge.mjs`, `src/runtime.mjs`, `src/mcp.mjs` and `src/desktop/` first.
- Node.js >=22. Run `npm ci && npm run verify && npm run test:integration`.
- Nontrivial work goes through a branch and PR with regression tests. Check Ubuntu/macOS/Windows CI.
- Never mark desktop UI acceptance done based solely on headless CI. Record OS versions and real interaction evidence.
- Do not commit credentials, private screenshots, local runtime manifests or personal paths.
