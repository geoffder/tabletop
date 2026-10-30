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
- **Stable board**: `eval:document.querySelector(".<board>").getBoundingClientRect().y` in each state. At a game's end the harness drops its own "It's your turn" bar (44px), so the board moves there in every title; that is harness chrome, not the title's layout.
- **Hidden pieces**: list piece groups whose opacity is not 1 after undo and history steps.
- **Mid-animation**: `tap:` then `wait:` 80–250 ms, then `shot:`.
- **Another player's move**: the harness plays every seat as its own, so `other-action` never fires there. A full-action history replay takes the same path (the piece drops in before it moves): click `step backwards`, then `play history` (both with `>> visible=true`, as the first copy is the hidden phone bar). A single `step forwards` carries no action and plays the quick path.
- **Frozen frames**: for an exact frame of a GSAP motion (a depth or overlap question the 25 fps video blurs), import the page's own GSAP module and slow or stop it: `eval:` an async function that finds the `deps/gsap.js` URL in `performance.getEntriesByType('resource')`, imports that exact URL (same module instance as the app), and calls `globalTimeline.timeScale(0.05)`; after a `wait:` call `globalTimeline.pause()` and shoot at `DPR=2`. While paused, hide one layer at a time with `eval:` and shoot again to find which one paints over which.
- **Slowed Svelte transitions**: Svelte 5 plays `in:`/`out:` transitions as Web Animations, which GSAP's timeline does not reach. Before the action, `eval:` a wrapper over `Element.prototype.animate` that sets each new animation's `playbackRate` to 0.05, then shoot every few hundred ms. The browser blends between the transition's sampled keyframes, so a step in opacity shows as a translucent frame or two at that speed; at full speed it lasts about one frame.
- **Frame strips of motion**: record the page (`recordVideo` on the Playwright context), note when the action was clicked, then crop and extract frames with `ffmpeg -ss … -vf "crop=…" -fps_mode passthrough` (25 fps) and tile them with `magick montage`. Playwright's fake clock (`clock.install()` then `runFor`) keeps running in real time between screenshots unless paused, so its strips showed wrong durations; paused, a history step played in one frame. A single pale frame just after a state lands can be the video encoder: confirm a glitch with an in-page `requestAnimationFrame` logger listing piece counts and every node whose computed opacity is not 1.
- **Finding what paints a pixel**: [`../scripts/pick.mjs`](../scripts/pick.mjs) lists every element under a point of a harness route, topmost first, with its index among its siblings, its fill and the start of its path; give a selector to place the point as fractions of that element's box (`GAME_UI=<slug>-ui node pick.mjs looks 0.925 0.694 'svg[data-look="light-punct"]'`). Pre-rendered images report only the `<image>`, so pick on the route that draws the look live. To see which generated part is which, colour them by index for one render (`hsl(index × 47 % 360 60% 60%)` with a thin stroke), and to test a guess, hide one layer with `eval:` and shoot again; put the colours back before rendering the looks for real.
- **Check generated geometry numerically** before drawing it: a few lines of `node` printing the function over the angles or distances in question (a notch's reach at 260–280°) shows a sign or branch error that a render shows only as a strange shape.
- **Opening a game and moving**: measure on phone stand-ins with `../scripts/perf.mjs`, as `performance.md` describes; a desktop page at 1× hides most of what makes a game slow on a phone. Vite's on-demand compile is rarely the cause: YINSH's whole runtime, 375 modules, compiled cold in ~1 s.
- **Refresh**: reload, reopen, shoot twice, and compare with `magick compare -metric AE a.png b.png null:` (0 means no motion). After a reload the harness shows no game: reopen it from the Games menu (the last entry with the scenario's name).
- Crop and zoom (`magick … -crop`) before judging small marks; `DPR=2` or `3` renders the page at that pixel density.
- **Piece grids**: for piece shape and colour rounds, a scratch route in the UI package (`src/routes/pieces/+page.svelte`) drawing every colour at every height, opened with `P=pieces`, beats hunting for positions; keep it out of commits.
- **Colours from photos**: sample a published piece or board with `magick photo.jpg -crop 20x20+X+Y +repage -scale 1x1! -format '%[hex:p{0,0}]' info:` at a few spots, and compare with the box art, which is usually more saturated. A photo with the box in frame calibrates itself: sampled under the same light, TZAAR's board gold matched the box art's sand, so the table took the rulebook's sand rather than the photo's darker raw value.
- **Colour variants by injected CSS**: set the override on the title's own table element (`.tzaar-table { --tzaar-table: … }`), not `:root`. The game's stylesheet defines its variables again on an element nearer the table, so a `:root` override does nothing. Symptom (TZAAR): a grid of four table shades showed one colour four times, and the user was asked to choose between them. Before shooting, `eval:` the computed value on the element that paints (`getComputedStyle(table).backgroundImage`) and confirm each variant differs.

## Covers

A real board render makes a good cover: open a scenario at a large viewport (1800×1250, or 1400×900 at DPR 2), hide the marks, coordinates and stack counts with an injected style, shoot, crop around the most telling pieces and resize to 640×640, and composite a title rendered from SVG (`magick base.png title.png -composite`). Offer the user several crops; re-render it when the table's colours or the pieces change.

## Phone-only bugs

The user reports these from a real phone, so start from their screenshot.

- Measure an element in it (a button, the board's label span) against the same element in your shot at that width. Everything uniformly larger means the page is zoomed in, not laid out wrong; see the viewport tag in `scaffold.md`.
- When the cause is still unclear, add a temporary readout to the harness page behind a query string (`?vp`): `innerHeight`, `visualViewport.height`, probes sized `100dvh`/`100svh`/`100lvh` and `env(safe-area-inset-*)`, the `--app-navbar-height` and `--app-banner-height` variables, the table's and game column's rects, and a small block fixed at `bottom: 0`. Ask for a screenshot with a game open, decide from the numbers, then remove it.

## Gotchas

- New game form: the first `player name` field is disabled; fill `input[placeholder="player name"]:not([disabled])`.
- The first request after Vite starts can time out while it optimises dependencies; retry.
- Only one game's harness can serve on 5173; switching branches stops the other title's harness. To work on a second title without disturbing uncommitted work, check its branch out as a worktree under `tmp/` (`git worktree add tmp/<slug>-wt <branch>`, then `pnpm install --prefer-offline` there in the container); its harness falls back to 5174, and `PORT=5174` points `shot.mjs` at it.
- The dev container's file watcher sometimes misses an edit made from the host, and Vite keeps serving the old module: a style you changed still computes to the old value. `touch` the file inside the container and reload.
- Running a title's `scripts/build-scenarios.mjs` rewrites every scenario file with new seeds and dates; restore the ones you did not mean to change.
- `click:text=Tall stacks` matches any text containing it, so it opened *Behind tall stacks*. Quote the text for an exact match: `click:text="Tall stacks"`.
- A recording's marks come from the script's clock, but on a cold dev server the video starts seconds later (a mark at 15.3 s in a 9.3 s video). Check the video's length with `ffprobe` and cut from its end when the marks overshoot.
- Stopping a background `devcontainer exec` (a second harness) leaves turbo and vite running in the container, still serving its port. Kill them inside the container (`ps -eo pid,args | grep <worktree>`), then confirm the port no longer answers.
- **A change that does not show**: confirm the source has it before suspecting the server. A scripted string replacement that no longer matches (Prettier had reflowed the lines) changes nothing and reports nothing; make such scripts assert each match. Then `curl` the module from Vite (`/src/lib/...ts`) and grep it for the change.
