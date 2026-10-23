# Table UI lessons

Each lesson names the symptom a user saw, so you can recognise it.

## Layout

- **Player cards.** Size a label column to its longest label (`max-content`), not a fixed width, so the space goes to the pieces.

- **Action panel height.** Symptom: the board jumps when the turn changes. Make the action panel one fixed-height message row, as Bus and Magna Grecia do: the last move while you wait, the prompt with its buttons inline on your turn, the step shown in history view. Anything else that always shows (a pool strip) sits below at a constant height. Check by reading the board's `getBoundingClientRect().y` on your turn, while waiting and in history: all equal.
- **Banner text.** Keep the banner's move text to one line: a brief form ("pushed ⚪ from D1 to D2, taking row D2–D5"); full detail (shifted counts, returned and captured counts) belongs in the history panel. One builder with a `brief` flag serves both.
- **Spaces in rich text.** Symptom: "removed B2and claimed". Svelte trims whitespace at the edges of `{#if}`/`{#each}` blocks. Build history lines as segments (text, piece, point) with the spaces inside the text segments, and test the joined text.
- **Coordinates.** Use the published notation, capital letters, BoardSpace style: label each column with its bottom point's name below it (A1) and its top point's name above it (A4). Separate letters above and numbers along the sides collide on a hexagon and read as wrong names. Labels sit about 0.6–0.72 × spacing from their point; compare the frame margin with sibling titles.

## Phones

- **Height budget.** Symptom: the board is small on a phone. On a phone the board is limited by height, so every row above it shrinks it. Keep each strip above the board one row on phones: a player's name beside their pieces, the name truncating first. Check the board's size at the phone sizes in `browser-checks.md` before and after the change.
- **Zoom bar.** Symptom: the bottom-left label hides under the zoom controls. Leave room in the board's `viewBox` below the bottom labels for them, and keep the board centred at full size. `ScalingWrapper` clips its content, so the bar cannot be nudged outside it, and a band reserved above the board with `insetTop` costs board size on every phone.
- **Overlay toggles** (light/dark) sit in an empty corner of the board's outline, where the fitted board leaves room, so the board needs no band reserved for them.

## Marks and highlights

- Draw highlight outlines thin (about 1.4, 2 when emphasised), on their own layer above the pieces, with radius `edge + gap + width / 2` so a thicker hover line grows outward and never covers the piece, and small enough that neighbouring outlines never meet.
- Mark a piece with something on its own top face (a spot, a recoloured existing ring) rather than a ring around it: large rings overlap neighbours. A toggle mark can recolour a feature the piece already has (a GIPF-piece's crown ring: green keep, red take).
- Offer a toggle only where both choices are sensible for the player; keep the rules engine permissive.
- Fade outlines rather than removing them; see `animation-lessons.md` for fading them with the move.

## Pieces and contrast

- Size pieces in one geometry module, as large as the tightest neighbouring pair allows, with a unit test asserting the gap (≥ 0, small) so later tweaks cannot introduce overlap.
- Keep details crisp when zoomed: blur shadows on their own layer and draw the piece without SVG filters; draw speckles as real seeded circles, not a `<pattern>`.
- A panel that shows a black piece needs a light background (trays, history panel, history list icons). On a light table, give faded controls (history buttons) a dark backing.
- Light/dark toggles: an icon showing the mode a press switches to (moon on light, sun on dark), with a matching `aria-label`.

## Full screen and zoom

- `ScalingWrapper`'s full screen is a modal dialog with a dim backdrop, so the table background vanishes. Render the same background class as a `position: fixed; inset: 0; z-index: -1` layer inside the `toolbar` snippet while expanded.
- Let small boards fill the space: `maxFitScale` above 1, `maxScale` for zoom, `renderAtViewScale`.
