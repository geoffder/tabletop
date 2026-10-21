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

Steps: `click:SEL` (then waits 0.6 s), `tap:SEL` (no wait, for mid-animation frames), `hover:SEL`, `fill:SEL=>VALUE`, `wait:MS`, `eval:JS` (prints the result), `reload:MS`, `shot:NAME` (writes `tmp/screens/NAME.png`). It prints page errors at the end. Give board elements `aria-label`s built from the game's notation ("place D4", "dot D1") so steps can name them.

## Checks worth scripting

- **Phone width**: run at `390 844` as well as desktop.
- **Stable board**: `eval:document.querySelector(".<board>").getBoundingClientRect().y` in each state.
- **Hidden pieces**: list piece groups whose opacity is not 1 after undo and history steps.
- **Mid-animation**: `tap:` then `wait:` 80–250 ms, then `shot:`.
- **Refresh**: reload, reopen, shoot twice, and compare with `magick compare -metric AE a.png b.png null:` (0 means no motion).
- Crop and zoom (`magick … -crop`) before judging small marks.

## Gotchas

- New game form: the first `player name` field is disabled; fill `input[placeholder="player name"]:not([disabled])`.
- The first request after Vite starts can time out while it optimises dependencies; retry.
- Only one game's harness can serve on 5173; switching branches stops the other title's harness.
