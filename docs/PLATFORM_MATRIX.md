# Desktop platform support

Host MCP configuration formats are tracked in [Compatibility](COMPATIBILITY.md). This page concerns **the device that displays overlays**, not the AI model supplier.

| Target OS | Current implementation | What must still be tested |
|---|---|---|
| macOS | Electron overlay/panel; read-only Swift Accessibility helper; local Broker; unsigned ZIP preview | Accessibility grants/revocation, Spaces, full-screen, moving/retina/multi-display control tracking, signing/notarization |
| Windows | Electron overlay/panel; PowerShell/.NET UI Automation helper; physical→DIP conversion; NSIS and portable previews | UAC/secure desktop limitations, mixed-DPI monitor moves, install/reinstall behavior and signing |
| Linux | Headless Node/MCP core and test suite | Native Wayland accessibility and desktop overlay acceptance are **not established**; no broad support claim |
| Remote/cloud Agent | Configuration may target a local stdio service on the same device | Remote control tunnel/companion protocol not implemented; cannot transparently reach the user's display |

Every OS inspection requires explicit local user opt-in. HandoffGlass does not click, approve, reveal passwords or bypass protected desktops.

See [Native runtime](NATIVE_RUNTIME.md), [Desktop QA](DESKTOP_QA.md) and [Codex handoff](CODEX_HANDOFF.md) for measured acceptance tasks.
