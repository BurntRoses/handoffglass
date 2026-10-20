# Model-agnostic, model-budget-aware invocation

HandoffGlass does **not** invoke a language or vision model itself; the surrounding Agent/harness supplies interpretation, vision and authority. Installing the same MCP server works across providers as long as the host supports compatible local stdio MCP and tool calls. This avoids provider lock-in and duplicated model SDK dependencies.

## Tiny / fast models and short context

- Set `HANDOFFGLASS_OUTPUT=compact` in the host's MCP environment or use `node scripts/configure.mjs HOST --compact`.
- Prefer **one** `session_start` with a concise action rationale and **no coordinates** if the host lacks grounded UI element access.
- Save the returned `session.id` and `nextCursor`, then call `session_wait` for meaningful changes. Carry each returned cursor into the next wait. Use a stable `requestId` on retries.
- Do not pass a base64 screenshot, verbose UI tree, password or one-time code in any handoff argument.
- Treat `user_action_reported` as unverified until the host rechecks the original app and calls `session_verify`. Finish only with `verified:true, finish:true`.

## Reasoning / vision-rich models

- Ground coordinates from the host's independently observed screen bounds or an approved accessibility provider. Convert into **global DIP**, not normalized image pixels. Call `screen_displays` first.
- Use multiple annotations only when targets are distinct and physically grounded. One spotlight is often enough.
- Use `session_start(mode:"guide")` for **nonblocking illustration**, and `session_start` when the task must suspend for a human decision.
- Reinspect the actual application after user-reported completion. UI movement invalidates old coordinates.

## Hosts with approval and sandbox rules

- Tool availability is different from user authorization. A host may ask permission to invoke HandoffGlass; HandoffGlass never bypasses that approval.
- Cloud / remote agent sessions have no automatic access to a physical desktop. Use a local, authorized companion if built in the future.
- Never train or store screenshots, secrets or UI text. No model-specific telemetry is needed.

## Measure before optimizing

Benchmark total human+agent task success, retries, approval errors, wall-clock, host tool calls, returned JSON bytes and user intervention count. `npm run bench:broker` measures only synthetic core event throughput, **not** GUI or model latency. Do not use benchmark values as real-world performance claims.
