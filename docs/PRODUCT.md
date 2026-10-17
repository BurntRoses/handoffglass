# Product definition — HandoffGlass

## Category

A **reusable agent-to-human interaction and visual handoff layer**. Not a new general-purpose AI assistant.

## User problems

- Computer-use tasks stall at MFA, OAuth review, OS authorization and delicate decisions.
- Text-only requests force humans to hunt for unfamiliar controls.
- More retries can be slower and cost more tokens than a short manual action.
- Existing desktop arrows and remote-browser handoff are fragmented and do not provide a vendor-neutral, well-defined decision-state interface.

## Positioning

**For Agent developers and advanced end users**, HandoffGlass exposes on-screen guidance + human-decision handoff as standardized tools. The Agent decides *when* to invoke it; HandoffGlass handles local presentation, refusal and result reporting.

## Explicit competitive boundaries

- Microsoft's screen-guided Copilot: full assistant product, integrated OS UX.
- big-arrow-on-the-screen: lightweight macOS pointer; strong low-level precedent.
- Handrail: GUI-aware teaching assistant; integrated vision/plan experience.
- Browserbase/Cloudflare: cloud-browser live handoff and session continuity.
- HandoffGlass: vendor-neutral MCP/Skill integration, consent-aware outcome semantics and desktop-local runtime. **The idea itself is not novel.**

## North-star metrics for real user validation

- Human handoff completion rate and separate downstream verification rate.
- False target rate: visual highlight falls on the incorrect element.
- False success rate: user-reported complete but action not actually completed.
- Time from Agent suspension to safe task resumption.
- User refusals respected, with no repeat prompting loop.
- Overlay target drift after window moves, display changes or DPI changes.
- Total model calls/tokens vs direct automation and text-only baseline.

## Go/no-go success criteria (future empirical targets)

The prototype does not have field measurements. Establish controlled test tasks before claiming lower cost or higher success. Compare HandoffGlass with text handoff using fixed scenarios and matched Agent models. Track number of interventions, failure causes and safety outcomes separately.
