# HandoffGlass visual identity

## Mark

The symbol describes one part of a desktop task moving safely from an Agent to a person, then returning to the Agent. Two offset glass-like windows frame a precise focus point; a crosshair marks guidance, **not automatic clicking**.

- Primary vector: [`assets/brandmark.svg`](../assets/brandmark.svg).
- Desktop application icons: generated deterministically from the same shape using `npm run build:icons`, producing PNG 32/256/512/1024, ICO and ICNS.
- Do not stretch the mark, use arbitrary emoji in place of it, or replace its precise center with a generic assistant/chat icon.
- Preserve space around the mark equal to at least 1/8 of its bounding square.
- At 16–32 px, prefer the icon without nearby small captions.

## Palette

| Role | Value | Use |
|---|---|---|
| Midnight | `#0b121a` | Main application and site background |
| Glass | `#162932` | Panels and window surfaces |
| Mint | `#a8f4d8` | Precise focus, success acknowledgment |
| Sea glass | `#78d8c6` | Lines, glows and secondary focus |
| Ink | `#e8f3f1` | Main text |
| Quiet | `#a1b8ba` | Supporting copy |

Use ample negative space and single-purpose emphasis. Strong glow is reserved for the target, not every button. Provide reduced-motion behavior through `prefers-reduced-motion` and the saved user preference, which takes precedence over Agent styling.

## Copy

Short, situational, human: “Review the access request”, “Your turn”, “Back to your agent”. Avoid anthropomorphizing the service and do not claim the tool has independently verified a permission or operation after a user taps “Done”. Chinese copy should be written idiomatically rather than translating English word by word.

## Release usage

The private repository currently has no open-source license (`UNLICENSED`), so third-party reuse and redistribution require the owner's separate permission. Desktop artifacts produced by GitHub Actions are unsigned previews until signing and real-device checks are completed.
