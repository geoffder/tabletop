# Performance

The user plays on an iPhone, and a desktop browser at 1× hides most of what makes a game slow there. MATRX GIPF opened in 0.15 s on desktop and in 10 s on a phone-sized page, and its moves stuttered only in WebKit. Measure on **phone stand-ins**, not by feel on desktop.

## Measuring

[`../scripts/perf.mjs`](../scripts/perf.mjs) opens a harness scenario in a phone-like page (390 × 655, DPR 3, touch) and prints the time until the board is drawn, the long tasks while opening, and frame timings while each tap's animation plays (fps, worst frame, and when each slow frame came). `THROTTLE=4` slows Chromium's CPU about to a phone's; `BROWSER=webkit` runs WebKit, the engine every iPhone browser uses; `PROFILE=open` or `PROFILE=move` adds a CPU profile (self time, inclusive time of app code, and the trace's style, layout and paint totals). The script's header gives the usage.

- Run both engines. Chromium slowed 4× shows script and style costs; only WebKit showed the cost of SVG images redrawn every frame.
- WebKit needs its system libraries once per container: `sudo -n env PATH=$PATH node games/<slug>-ui/node_modules/@playwright/test/cli.js install-deps webkit`, then `pnpm exec playwright install webkit`.
- The dev harness measures like a production build here (MATRX: `vite build` + `vite preview` gave the same numbers), so the dev server is fair for these comparisons.
- Targets that felt fine: open under 0.5 s with Chromium at 4×; moves at 55 fps or better in WebKit, with no frame over 50 ms except the one where the new state lands.
- Test a suspected cause by swapping it out in the page before rebuilding anything: MATRX replaced every piece's drawing with an image of it from an `eval`, measured, then built the change that won.

## What was slow, and what fixed it

- **Measuring nodes as they attach.** GSAP's `svgOrigin` (and any first tween of a node) parses its transform and calls `getBBox`, which forces a style recalculation of the whole SVG; done in an attachment for every disc, each one recalculated a board that grew with each disc. MATRX: 10 s to open on a phone-sized page. Set origins only on the nodes a move scales, as the move starts (see `animation-lessons.md`).
- **Rich drawings drawn live.** MATRX's carved pieces ran to hundreds of paths with masks and clip paths each, and the small piece icons on player cards, the reserve strip and the history held more of them than the board did (6,800 of 10,600 SVG elements). Sharing one drawing through `<defs>` and `<use>` saved nothing: every `<use>` clones its subtree for styling, so the page still carried them all. Pre-render each look instead (below).
- **SVG images in motion on WebKit.** Shown as `<image href="look.svg">`, a look leaves the page but WebKit redraws the SVG every frame it moves: 60–100 ms frames during each slide, while Chromium held 60 fps. Bitmaps fixed it (WebKit push 48 → 63 fps).
- **Blur filters** on shadows: draw them as radial-gradient fills (see `ui-lessons.md`). MATRX's open time on WebKit fell by a third when its 16 filtered shadows went.

## Pre-rendering piece looks

When a piece's drawing is more than a few dozen elements, draw each look once ahead of time and show it as a bitmap, by the same rule as other generated art (`ui-lessons.md`, *Pre-render generated art*):

- A dev route in the UI package (`src/routes/looks/+page.svelte`) draws every look live, each in its own `<svg data-look="<name>">` with only the gradients it needs, at the board's piece radius.
- `scripts/render-looks.mjs` opens that route with Playwright against the running harness, copies each look's computed `fill`, `stroke` and similar styles onto its elements (component-scoped CSS does not travel with the markup), keeps only the gradients it references, draws it on a canvas from an SVG blob, and saves `toDataURL('image/webp', 0.9)` to `src/lib/images/looks/<name>.webp`. Commit the images and the route.
- Size the bitmaps for the board's full zoom on a phone: 12 px per board unit gave a disc about 640 px across, 12–19 KB per look.
- Load them with `import.meta.glob('../images/looks/*.webp', { eager: true, query: '?url', import: 'default' })` and draw each piece as an `<image>` over its look's box. Keep the animated nodes (each disc's wrapper, its shadow) as before; only the drawing inside becomes an image.
- Rerun the script after any change to how a piece is drawn, and check the result as the board shows it: render the image files themselves large on a coloured background, so cut-outs and edges show.
