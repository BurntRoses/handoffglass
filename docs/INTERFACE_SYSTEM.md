# Desktop interface

The main window has three primary pages: guidance, connections and appearance. Help sits at the bottom of the sidebar. Native application menus provide settings, editing, window management and quit.

- **Guidance:** the current state, one action to manage connections and three status rows. An active handoff and an unavailable desktop have distinct text.
- **Connections:** app selection and copying configuration. Raw TOML/JSON is collapsed. Request records reflect observed calls, not a verified host identity.
- **Appearance:** an interactive preview, style, motion, theme, language and spacing. The preview uses `overlay-renderer.mjs` and `marks.css`; previewing never persists settings. Save commits them.
- **Help:** explicit element-lookup consent and a connection check. Enabling consent saves immediately; OS Accessibility permission is separate. Diagnostics, display geometry, version and the event log live inside a closed details element.
- **Setup:** three compact steps in one column. “Settings saved” does not claim a client has connected.
- **Handoff:** title, action and two decision buttons. Cancel is available in the header. Countdown appears only in the final minute. A target-lost note appears only when applicable. User completion remains unverified until the agent checks the original application.

All pages use local files, system fonts and SVG icons. `ui-tokens.css` supports light, dark and system themes. Preferences remain user-owned. The overlay never intercepts mouse events or steals focus; reduced motion and forced colors remain supported.

Renderer IPC is allowlisted, sandboxed and checked against the sending window. Generated configuration comes from `hostConfig()` for both preview and clipboard. It uses Electron Node mode in packaged and source installations. Display preview and configuration generation make no screen captures or remote requests.

Run `npm run test:release-ui` on an interactive desktop to exercise saved/unsaved previews, language, permission persistence, closed disclosures, a narrow window, setup and a real handoff decision. Screenshots are written to `.tmp/release-ui/`. Run `npm run test:desktop` for startup, isolation and geometry checks.
