# HandoffGlass Architecture — v0.3

## Responsibility

A locally hosted, model-independent MCP tool for passing the next action from an agent to a person, showing on-screen guidance, receiving a decision, and returning a **user-reported** result. It does not verify the target app, capture pixels, read passwords, grant permissions, or solve authentication challenges.

## Processes

1. Every host launches `src/mcp.mjs` via stdio. This adapter exposes six MCP SDK v2 tools. It has its own random ownership ID but does not own the desktop or session state.
2. `src/runtime.mjs` ensures a private runtime directory, uses an atomic startup lock, reads a guarded broker manifest, probes the live broker, and lazily starts `src/broker.mjs` if required. The manifest stores a random **agent-only** bearer, ephemeral local port and PID.
3. `src/broker.mjs` is one long-lived process shared by all MCP adapters. It owns one `HandoffManager`, one `LocalBridge`, and at most one Electron desktop process. It persists when an MCP stdio host exits; `broker:stop` explicitly ends it.
4. The `HandoffManager` enforces one active session across hosts; the owning client can supersede its own session, but another host receives a **busy** error. State queries, waits and cancels are owner-scoped. The user-interface decision channel resolves the active session ID without requiring agent ownership.
5. `LocalBridge` binds only `127.0.0.1`, has a random port, separate agent and desktop bearers, origin/host checks, JSON body limits, and revision-based long polls. Only `/agent/*` endpoints accept the agent token; only `/hello`, `/poll`, `/state`, `/decision` accept the desktop token. `/health` accepts the agent token.
6. Electron creates a transparent, mouse-through window per screen and a separate, clickable human response panel. UI renderers are isolated from Node and navigation, with a small validated preload IPC surface.

## Handoff lifecycle

`awaiting_user → completed | declined | cancelled | expired | superseded`

- Terminal results cannot change.
- A `completed` outcome means a person reported completion, **never** proof of a successful action. `verified = false` is deliberate.
- A new session from the **same owner** supersedes its previous one; another owner gets `busy`, preserving a single meaningful user prompt.
- Broker shutdown clears ephemeral session history. Restart can recover the server but **not** abandoned session state; clients must reestablish intent.
- A client whose process exits can leave a pending handoff until its existing TTL expires. This is a product constraint, not a guarantee of live ownership.

## Coordinates and target integrity

HandoffGlass accepts global device-independent pixel (DIP) coordinates only. Left/upper secondary monitors can have negative coordinates. Screenshot pixels must be calibrated independently. It requires target coordinates from an existing accessibility tool, DOM or measured Computer Use observation, and rejects annotations outside connected monitors. It does not have a built-in visual or UI automation grounding engine.

Display changes are debounced and presented as revisioned snapshots. Stale `show` commands cannot replay after Electron reconnects. A manual desktop acceptance checklist lives in `docs/DESKTOP_QA.md`.

## Limits

No automatic OS accessibility resolution, protected desktop overlay guarantees, production signing, continuous video understanding, screen capture, remote browser sync or commercial hosted service. CI tests protocol behavior and basic cross-platform Node APIs, not Electron rendering in an actual user's graphical session.
