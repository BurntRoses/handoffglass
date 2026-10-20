# HandoffGlass visual identity

The mark is an open circle with a separate point. It refers to pointing out a place on screen.

- Vector source: [`assets/brandmark.svg`](../assets/brandmark.svg).
- `npm run build:icons` exports PNG, ICO, ICNS, the development Dock icon and monochrome macOS menu bar templates at 1× and 2×.
- The app icon has a 70/88 inset to preserve normal macOS Dock proportions. Pixel edges use alpha coverage; the small menu bar symbol is separate from the app tile and uses system template tinting.
- Navigation and action icons are local SVG paths, without font glyph dependencies.

The desktop uses warm white or neutral charcoal, system fonts, thin separators and a muted green accent. Primary actions use a solid neutral button. Detailed status and configuration appear only when expanded. Desktop interface colors are in `src/desktop/ui-tokens.css`; the public site retains its own palette.

Use short labels: “连接”, “外观”, “保存”, “我已完成”. A single explanatory sentence is enough for a step. Remove taglines, duplicate statuses, developer commands and repeated small-print descriptions from normal screens. Show an additional note only when it changes the action, such as a lost target.

Drawings animate once and respect reduced motion. The appearance preview uses the production SVG renderer and shared motion CSS.

Packaging and interface polish do not imply signing or notarization. Distribution still needs the owner's signing identity and Apple notarization credentials.
