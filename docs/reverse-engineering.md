# EXCLUSIVE artifact reverse engineering

The supplied `EXCLUSIVE-share.html` is a transport wrapper around a JSON-encoded HTML template, embedded font resources, and a small custom `DCLogic` runtime. The production rebuild intentionally does not reuse that wrapper.

## Extracted structure

1. Fixed two-pixel gradient scroll-progress rail.
2. Fixed three-part header: `EXCLUSIVE`, `MEMBERS ONLY`, `MENU +`.
3. Kinetic right-side/full-screen menu with three sliding violet panels and five room links.
4. Hero: midnight aurora, contextual 03:41 AM metadata, masked gradient wordmark, “ENTER THE ROOM”, scroll cue, and delayed product statement.
5. Social chaos: twelve floating English/Hinglish fragments that build, move toward the center, disappear, and resolve into “EVERYTHING, FINALLY SORTED.”
6. Sticky five-room module selector.
7. Connected journey: TEA → ONE DAY → ALIGN → CREATE → VAULT.
8. Bento-style room overview.
9. Invite-only access CTA and compact footer.

## Design tokens

- Background: `#0b0a14`
- Panel: `#14121f`
- Foreground: `#f4f1ff`
- Muted: `#a49fc4`
- Violet: `#6b5bff`
- Pink: `#ff5cc8`
- Cyan: `#5be0ff`
- Display: Bebas Neue
- Body: Space Grotesk
- Navigation/metadata: Space Mono

## Cause of the empty scroll region

The original hero is `250vh` tall and its sticky child stops pinning when the section has one viewport remaining. The following chaos section does not begin updating its `--p` progress until its top has already reached the viewport top. Every chaos fragment derives opacity from that still-zero progress. During the viewport-long handoff, the hero content is moving away while the chaos content remains fully transparent, producing the navigation-only dark screen.

The rebuild uses adjacent ScrollTrigger pins and starts the chaos scene with a small set of visible fragments. Its entrance begins at the exact hero handoff, then builds progressively before convergence, so there is no inactive scroll range.
