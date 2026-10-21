# Product interaction and decision logic

This is an implementation contract for an Agent-friendly overlay, not a roadmap full of speculative features.

## Three moments

1. **Explain** (passive `session_start(mode:"guide")`): the Agent has measured coordinates and supplies a semantic template or Scene v1; a click-through overlay shows the target and disappears at the session TTL or owner cancellation. No forced interrupt.
2. **Ask** (`session_start`): the Agent needs human judgment or an operation it should not perform. A dedicated panel explains the action with **Complete / Decline / Cancel**. All three choices are first-class; 'Complete' means only user-reported action. The same session remains visible during verification and the next step.
3. **Continue** (`session_wait` → `session_verify` → `session_present`): the Agent independently checks the external app after the user reports completion. If it cannot check, say that the result is unverified. Do not presume authorization, purchase or policy acceptance.

## Agent decision table

| Observed condition | Agent action | Overlay behavior |
| --- | --- | --- |
| UI target precisely grounded | `session_start(mode:"guide")` with `template` | Brief semantic mark, no modal panel |
| UI target ambiguous | `session_start` without coords | Describe task, allow rejection, no guessed arrow |
| MFA, payment, consent, personal data | `session_start`, optionally `caution` with measured bounds | Warn what is requested; user is free to decline |
| Agent can operate safely and quickly | Do not call HandoffGlass | No added UI friction |
| Agent needs to revise a multi-step visual | `session_update` with expectedRevision | Modify scene without resetting the human's session |
| Multiple agents contend for UI | One returns `busy`; wait or coordinate | Existing owner's instructions remain |
| User declines | Stop that dependent branch or ask for alternative | Do not retry approval prompt blindly |
| User reports completion | Independently verify | Never assert success solely from `completed` |

## Panel and overlay are different surfaces

- Transparent overlay: cannot intercept clicks, cannot display secret input boxes, cannot trigger native action. Its shape and labels must remain legible over many applications.
- Handoff panel: separate interactive window for explicit human feedback, visible only during active handoff. Panel always includes an easy refusal path.
- Session coordinator: no model-specific state, no camera, no cloud API; Agent calls standard MCP tools.

## Six template use cases

- `focus`: demonstrate a toolbar region while teaching software.
- `point`: locate a button the user was already intending to select.
- `inspect`: outline document or settings information that should be read.
- `caution`: mark a consequential prompt to review (without implying consent).
- `sequence`: number 2–8 explicitly grounded independent interface targets.
- `verify`: identify an area to check after a user action, without claiming the app successfully updated.

## Non-goals and future capability gates

- Auto-click, CAPTCHA bypass, MFA automation, automatic consent: **not a product objective**.
- OS-native AX/UIA element targeting: available as an opt-in adapter, with stale/ambiguous/occluded checks and permission gating.
- Real-time voice/video: future *optional* capability, only after proving that simple event-driven guidance is insufficient. Never require a second model subscription to use MCP.
- Installer: separate OS build and real desktop smoke tests required; headless CI does not satisfy this criterion.

## Quantitative evaluation

Collect *synthetic, privacy-safe* benchmarks: target precision, number of mistaken clicks, assistance-trigger rate, successful return to Agent, end-to-end elapsed time, model token usage, and users choosing Decline. Compare visual template vs plain text vs full manual handoff. No user screen telemetry by default.
