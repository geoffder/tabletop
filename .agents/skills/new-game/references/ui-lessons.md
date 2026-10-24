# Table UI lessons

Each lesson names the symptom a user saw, so you can recognise it.

## Layout

- **Player cards.** Size a label column to its longest label (`max-content`), not a fixed width, so the space goes to the pieces.

- **Action panel height.** Symptom: the board jumps when the turn changes. Make the action panel one fixed-height message row, as Bus and Magna Grecia do: the last move while you wait, the prompt with its buttons inline on your turn, the step shown in history view. Anything else that always shows (a pool strip) sits below at a constant height. Check by reading the board's `getBoundingClientRect().y` on your turn, while waiting and in history: all equal.
- **Banner text.** Keep the banner's move text to one line: a brief form ("pushed ⚪ from D1 to D2, taking row D2–D5"); full detail (shifted counts, returned and captured counts) belongs in the history panel. One builder with a `brief` flag serves both.
- **Spaces in rich text.** Symptom: "removed B2and claimed". Svelte trims whitespace at the edges of `{#if}`/`{#each}` blocks. Build history lines as segments (text, piece, point) with the spaces inside the text segments, and test the joined text.
- **Coordinates.** Use the published notation in capital letters, laid out as BoardSpace lays out that game, which differs by game: open BoardSpace's own picture of the board first. ZÈRTZ, GIPF and LYNGK label each column with its bottom point's name below it (A1) and its top point's name above it (A4), where separate letters above and numbers along the sides collide and read as wrong names; YINSH puts the letters under the columns and the numbers before each line on the left. Labels sit about 0.6–0.72 × spacing from their point; compare the frame margin with sibling titles.
- **Player areas off the board** (YINSH's ring spaces) belong to a seat, not to the viewer. Symptom: a removed ring flew to one corner and then appeared in the other. The harness switches viewer after every action, so viewer-relative sides swap mid-animation. Fix each player's side by turn order, matching the order of the player cards.

## Phones

- **Height budget.** Symptom: the board is small on a phone. On a phone the board is limited by height, so every row above it shrinks it. Keep each strip above the board one row on phones: a player's name beside their pieces, the name truncating first. Check the board's size at the phone sizes in `browser-checks.md` before and after the change.
- **Zoom bar.** Symptom: the bottom-left label hides under the zoom controls. Leave room in the board's `viewBox` below the bottom labels for them, and keep the board centred at full size. `ScalingWrapper` clips its content, so the bar cannot be nudged outside it, and a band reserved above the board with `insetTop` costs board size on every phone.
- **Overlay toggles** (light/dark) sit in an empty corner of the board's outline, where the fitted board leaves room, so the board needs no band reserved for them. Put a new toggle on the row of an existing one: stacked one per row, ZÈRTZ's third toggle came down onto the top coordinate label on phones.

## Marks and highlights

- Draw highlight outlines thin (about 1.4, 2 when emphasised), on their own layer above the pieces, with radius `edge + gap + width / 2` so a thicker hover line grows outward and never covers the piece, and small enough that neighbouring outlines never meet. Where pieces touch (ZÈRTZ's rings, packed as on the table), draw the outline just inside the edge instead, `edge − inset − width / 2`, so it stays on its own piece.
- Mark a piece with something on its own top face (a spot, a recoloured existing ring) rather than a ring around it: large rings overlap neighbours. A toggle mark can recolour a feature the piece already has (a GIPF-piece's crown ring: green keep, red take).
- Offer a toggle only where both choices are sensible for the player; keep the rules engine permissive.
- **Hover previews on touch.** Symptom (iPhone): a tapped ring flashed the hover preview, then showed nothing until the move landed. A tap fires pointer enter and leave around the click; ignore enter when `event.pointerType === 'touch'`.
- Fade outlines rather than removing them; see `animation-lessons.md` for fading them with the move.
- **Marks on stacked or tall pieces** (DVONN): draw each mark inside its piece's group, after the piece but outside the group that animates, so pieces in front cover it as they cover the piece; keep them registered with the animator so all of them fade with the move.
- **Dashed marks on light pieces**: outline each dash on its own rather than laying the dashes on a solid dark band. The black dashes are shorter but square-capped, overhanging each coloured dash by the outline width; the piece shows between dashes.

## Pieces and contrast

- **Pack pieces as the real game does.** ZÈRTZ's rings touch on the table; the first version left a gap that the user removed.
- Size pieces in one geometry module, as large as the tightest neighbouring pair allows, with a unit test asserting the gap (≥ 0, small) so later tweaks cannot introduce overlap.
- Keep details crisp when zoomed: draw the piece without SVG filters, and speckles as real seeded circles, not a `<pattern>`.
- Draw shadows as radial-gradient fills, not a blur filter over a group of them. Symptom (YINSH, on an iPhone; not reproduced in Chromium): a removed ring's shadow stayed until the next move, consistent with WebKit not repainting under a filter whose children were removed.
- A panel that shows a black piece needs a light background (trays, history panel, history list icons). On a light table, give faded controls (history buttons) a dark backing.
- Light/dark toggles: an icon showing the mode a press switches to (moon on light, sun on dark), with a matching `aria-label`.

## Stacks

From DVONN, where stacks reach 20 pieces and only the top colour and the DVONN pieces inside matter.

- **Height must be unmistakable.** Put the count on the top piece (DVONN: in the donut's hole, white outlined in black, for stacks of two or more), and let the stack rise as a physical pile up to a cap (the user chose 10 after seeing 7–10), thinning every band above the cap instead of rising further. Show the user the cap as a labelled grid of heights on a scenario where it hides the most.
- **Where a tall stack hides most**: the two neighbours in the row behind it, which overlap it sideways; the space straight behind stays clear. Keep a harness scenario with pieces, stacks and a special piece in those spaces.
- **Pieces that matter inside a stack** (DVONN's red pieces) keep most of their band's thickness (0.8) when the rest thin out, capped at half the stack's rise. Symptom: a buried red piece became a 1px line.
- **Seams between same-coloured dark pieces**: black bands with a black edge run together. A faint white catch-light along the top of a black band whose piece has another black piece on it parts them; none on the top piece (it should look like a single piece) and none between different colours, which part already. The user compared a grey edge, a catch-light and a dark gap, and chose the catch-light.
- **Donuts are see-through.** Leave the hole open: down it draw each piece's inner wall at its true thickness (even where its outside band is thinned), with a thin seam between pieces, clipped to the top opening; below the last wall the board shows. Symptom: a tall thinned stack showed sand down its hole. A white piece's inner wall needs to be pale (the shadowed grey read as a dark smudge against the sand).
- **Speckles belong to the piece, not the place.** Symptom: a piece's speckle pattern changed as it hopped onto another stack. Seed each piece by an identity stored in game state (DVONN records `placedAt`, the space it was placed on), never by space and level; hand-built scenario pieces each need a distinct identity, or a stack's pieces share one pattern.

## Player cards

- **Tally what players count** (GIPF, after DVONN): each row is a bold count, a one-word caption (`reserve`, `GIPF`, `captured`) and the pieces themselves drawn small with the board's piece shape, in stacks no taller than 3 (the user chose 3 over 4). A special piece shows as itself, each GIPF-piece as its own two-disc stack, never gathered into taller stacks. Captured pieces show in the opponent's colour. Give the count column a fixed two-digit width so both cards' captions line up.

## Session tests

Rune classes such as the session only react when compiled for the client; under the SvelteKit plugin's server build, a `$derived` read in a test stayed at its first value. Give the UI package its own `vitest.config.ts`, as Hill Country Grocers does: the plain Svelte plugin, `resolve.conditions: ['browser']`, the `$lib` alias, and `config/config-vitest/clientRunesEnvironment.ts` as the environment. The root Vitest projects then pick the package up too. Then:

- Build the session with `createHarnessAppContext` and a local game whose seat has the harness user's id (`harness-user`), and stub `saveGameLocally`.
- `await session.waitForVisibleTransitionSettled()` after constructing it and after every action, Undo and history step. Until the first presentation settles the session is busy and ignores actions without an error. History also holds its stepping lock until a `setTimeout`, so wait one timer between steps.
- Stub `addEventListener` and `removeEventListener` globally: title preferences listen for window focus, and the client environment's `window` is Node's global.
- `new URL(path, import.meta.url)` becomes an asset lookup in the client build (`self is not defined`); build file paths with `fileURLToPath(import.meta.url)` instead.
- Check a new test fails with the fix switched off.

## Table textures

- **A background that runs past the board** (YINSH's storm of cloud): an image inside the board's SVG is clipped at the board's frame by `ScalingWrapper`. Draw it on a layer behind the table instead, positioned from the board's `getScreenCTM()` so it lines up with the board through fitting, zoom and pan (observe resizes and the wrapper's `style` changes). Make the layer `absolute` inside the table, so it scrolls with the table on phones, and `fixed` only inside the full-screen dialog.
- **A board with margins and rounded corners** (DVONN's sand board): SVG clip paths ignore strokes, so a polygon stroked wide with round joins draws the shape but cannot clip a texture to it. Compute the outline offset by the margin, with an arc at each corner, and use that path for both.
- **A printed edition's colours**: when the user points at the rulebook, take the table from it too (DVONN: the rulebook's red, glowing orange towards the middle), and warm every panel, tab and history control to match rather than leaving the earlier titles' navy.
- **Generated textures.** `feTurbulence` piped through `feColorMatrix` must set the color in the matrix's offset column and take alpha from a noise channel; otherwise the clouds come out grey-black and darken everything. Noise warped by `feDisplacementMap` shows seams when tiled, so draw one large image. Filter noise gave laminar streaks or random marbling; the look the user wanted (one storm centred on the board, with eddies) came from tracing thousands of faint streaks along a wind field on a canvas, drawn once and shown as an image.

## Full screen and zoom

- `ScalingWrapper`'s full screen is a modal dialog with a dim backdrop, so the table background vanishes. Render the same background class as a `position: fixed; inset: 0; z-index: -1` layer inside the `toolbar` snippet while expanded.
- Let small boards fill the space: `maxFitScale` above 1, `maxScale` for zoom, `renderAtViewScale`.
