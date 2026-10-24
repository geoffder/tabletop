# Browser checks

Look at the game in a real browser after every visible change; type checks do not catch layout, contrast or animation bugs.

## Setup (once per container)

Inside the dev container: `cd games/<slug>-ui && pnpm exec playwright install chromium && pnpm exec playwright install-deps chromium`.

## Driving the harness

[`../scripts/shot.mjs`](../scripts/shot.mjs) runs a list of steps against the harness at `http://localhost:5173` from inside the container:

```
GAME_UI=<slug>-ui node .agents/skills/new-game/scripts/shot.mjs 1400 900 \
  'click:button:has-text("Scenarios")' 'click:text=Capture chain' wait:1500 \
  'click:[aria-label="jumper D4"]' 'tap:[aria-label="land F2"]' wait:200 shot:mid-jump
```

Steps: `new:VARIANT` (creates a game named Test; the variant label is optional), `click:SEL` (then waits 0.6 s), `tap:SEL` (no wait, for mid-animation frames), `hover:SEL`, `fill:SEL=>VALUE`, `wait:MS`, `eval:JS` (prints the result), `reload:MS`, `shot:NAME` (writes `tmp/screens/NAME.png`). It prints page errors at the end; `Q='?vp'` adds a query string to the harness URL. Give board elements `aria-label`s built from the game's notation ("place D4", "dot D1") so steps can name them.

## Checks worth scripting

- **Phone sizes**: run at `390 655` (the visible area of Firefox on an iPhone, with its bars showing) and `375 600` as well as desktop. On these the board is limited by height, so compare its size before and after any change above it.
- **Overlap**: read `getBoundingClientRect()` of the two things that may collide (a corner label and the zoom bar) at each size. Wait 1.5 s after opening a scenario before measuring sizes: the board is still fitting before that.
- **Stable board**: `eval:document.querySelector(".<board>").getBoundingClientRect().y` in each state.
- **Hidden pieces**: list piece groups whose opacity is not 1 after undo and history steps.
- **Mid-animation**: `tap:` then `wait:` 80–250 ms, then `shot:`.
- **Frame strips of motion**: record the page (`recordVideo` on the Playwright context), note when the action was clicked, then crop and extract frames with `ffmpeg -ss … -vf "crop=…" -fps_mode passthrough` (25 fps) and tile them with `magick montage`. Playwright's fake clock (`clock.install()` then `runFor`) keeps running in real time between screenshots unless paused, so its strips showed wrong durations; paused, a history step played in one frame. A single pale frame just after a state lands can be the video encoder: confirm a glitch with an in-page `requestAnimationFrame` logger listing piece counts and every node whose computed opacity is not 1.
- **Refresh**: reload, reopen, shoot twice, and compare with `magick compare -metric AE a.png b.png null:` (0 means no motion).
- Crop and zoom (`magick … -crop`) before judging small marks.

## Covers

A real board render makes a good cover: open a scenario at a large viewport (1800×1250), hide the marks and coordinates with `eval:`, shoot, crop 640×640 around the most telling pieces, and composite a title rendered from SVG (`magick base.png title.png -composite`). Re-render it when the table's colours change.

## Phone-only bugs

The user reports these from a real phone, so start from their screenshot.

- Measure an element in it (a button, the board's label span) against the same element in your shot at that width. Everything uniformly larger means the page is zoomed in, not laid out wrong; see the viewport tag in `scaffold.md`.
- When the cause is still unclear, add a temporary readout to the harness page behind a query string (`?vp`): `innerHeight`, `visualViewport.height`, probes sized `100dvh`/`100svh`/`100lvh` and `env(safe-area-inset-*)`, the `--app-navbar-height` and `--app-banner-height` variables, the table's and game column's rects, and a small block fixed at `bottom: 0`. Ask for a screenshot with a game open, decide from the numbers, then remove it.

## Gotchas

- New game form: the first `player name` field is disabled; fill `input[placeholder="player name"]:not([disabled])`.
- The first request after Vite starts can time out while it optimises dependencies; retry.
- Only one game's harness can serve on 5173; switching branches stops the other title's harness.
