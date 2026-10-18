# Local-first memory and event-driven guidance

## Separation of concerns

1. **Authoritative ephemeral handoff:** the broker owns active session IDs, human report, expiry and `verified:false`. Never put passwords or personal screen content in this state.
2. **User-managed preferences:** local `~/.handoffglass/preferences.json` contains only a strict whitelist: `visualStyle`, `motion`, `locale`, `density`. It is saved atomically with per-user permissions. Read is non-mutating. Reset is explicit. Memory is **opt-in by user writing**; absence of file is the default, not hidden tracking.
3. **Harness memory:** host decides whether and how to remember a user's explicitly provided preferences. HandoffGlass does not access or mutate the host's chat memory automatically. This prevents untrusted screen content from poisoning durable memory.

## CLI

```sh
npm run preferences -- show
npm run preferences -- set visualStyle=handdrawn
npm run preferences -- set motion=off
npm run preferences -- reset
npm run blueprints -- authorization
```

Desktop tray offers visual style and motion selection for subsequent handoffs. System OS reduced-motion setting overrides cosmetic animations.

## Decision pipeline

- L0 local deterministic: foreground locator exact matching, display geometry, coordinate validity, existing session state, scene revision.
- L1 local pure rules: six blueprint names and localized step text; no model inference, no screen capture, no network and no approval automation.
- L2 optional harness reasoning: only if the user's task needs interpretation, ambiguous target cannot be grounded, or human asks a context question.

Do **not** interpret fewer model calls as proof of the same accuracy. Compare task success and unauthorized-action avoidance in real tests. The core can return a compact session digest, but the harness must independently check the application's actual post-action state.

## Privacy and portability

Preferences deliberately **do not** include filenames, window titles, account identities, OAuth scopes, conversations, approval history, credentials, screen captures or telemetry. Avoid persisting raw Accessibility tree values without new explicit permission and threat modeling.

To extend memory to a host like DeepSeek Harness, add a plugin-owned `preference.read` adapter, not a broad conversation log sync. Keep scope local; include clear consent and revocation before any cloud sync.

**Precedence:** whenever a human has saved a preference record, `visualStyle` and `motion` from the model-facing handoff request cannot override it. Without saved preferences, an Agent may suggest a per-scene visual style, but the OS reduced-motion setting still prevails.
