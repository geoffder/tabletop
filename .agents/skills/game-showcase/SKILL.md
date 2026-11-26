---
name: game-showcase
description: Capture showcase screenshots and real-time GIFs of a game title from its dev harness. Use when asked for screenshots, GIFs or clips showing off a game, its UI or one of its animations.
---

# Game showcase

A showcase is a set of **moments**, each one still (a screenshot) or one action played on the board
(a GIF), captured from the title's dev harness. A GIF plays in **real time**: every frame is held for
as long as the browser showed it, so the motion reads exactly as a player sees it.

[`scripts/showcase.mjs`](scripts/showcase.mjs) holds the capture helpers;
[`scripts/encode.sh`](scripts/encode.sh) turns captured frames into GIFs.
[`examples/mexica-capture.mjs`](examples/mexica-capture.mjs) is a whole title's capture script:
twelve screenshots and nine GIFs.

## Steps

1. **List the moments.** For each, write the position, the action, and what the viewer should see
   happen ("Bob steps off the bridge into a 6-square district; picking a temple lights the district
   up; the temple drops onto P6"). Cover what the user named. Where they asked broadly, cover the
   table, the board up close, choices on the board, each kind of action's animation, scoring and
   the end of the game, and a phone. Done when every moment has a position, an action and a result.
2. **Find each position.** Prefer the title's harness scenarios (`src/scenarios/README.md` says
   what each sets up). An action that is disabled where you expected it has a rule precondition:
   read the rule query behind the button (Mexica temples go only into the district where the
   player's Pilli Mexica stands). When no scenario fits, **search** for one: in a page with the
   session exposed, walk each scenario's state with the logic's own rule queries, trying every
   legal action and the squares a short walk reaches, and print the positions where the moment
   happens (Mexica: digs that close off a district matching a token on display, found from
   Middle game's mainland). A moment that needs a position no scenario reaches gets one through
   the `add-harness-scenario` skill. Done when every moment's action is offered in its position.
3. **Write the capture script** in `/workspace/tmp/<slug>/showcase/capture.mjs`, one job per
   moment, after the example, importing `showcase.mjs` by its path in the container (wherever this
   skill is checked out). Steps between staged clicks wait 0.7 to 1.4 s, long enough for a
   highlight or prompt to read; a GIF crop holds the squares the motion crosses with room above for
   tall pieces, kept inside the board's picture.
4. **Capture.** Start the harness from the title's UI package, detached so it outlives the
   command: `(setsid nohup pnpm run dev --port <port> --host 0.0.0.0 > /tmp/<slug>-harness.log 2>&1
   < /dev/null &)`. Vite moves to the next free port when one is taken, and another worktree's
   harness may hold the usual one: read the port from the log's `Local:` line. Run `node capture.mjs [job...]` in the container as the node user, then
   `scripts/encode.sh /home/<user>/git/tabletop/tmp/<slug>/showcase` on the host. Done when every
   job printed and no job reports page errors.
5. **Look at every capture.** Tile each GIF's frames into a sheet
   (`ffmpeg -i x.gif -vf "select='not(mod(n\,8))',scale=400:-1,tile=4x3" -frames:v 1 sheet.png`)
   and the screenshots into another (`magick montage *.png -geometry 720x+6+6 -tile 3x`). Done
   when each sheet shows its moment: the motion inside the crop from start to end, nothing of the
   harness's own bar, nothing cut off at an edge. Leave out a view that shows the UI badly (a
   portrait tablet with half the screen empty) and say so.
6. **Deliver**: the folder's absolute path, a line per GIF on what happens in it, and the best
   few embedded as images.

## Real-time capture

- `gif()` takes a CDP screencast. Each frame carries the time it was painted, and `encode.sh`
  holds each for the time until the next, then resamples to 30 fps. Playwright's `recordVideo` is
  25 fps at a low bitrate, and a page clock (`clock.install`) distorts durations.
- Screencast frames arrive at CSS-pixel size whatever `deviceScaleFactor` is. For a sharp GIF open
  a big viewport at 1x (2400×1500): the board scales up to fill it.
- A screencast sends a frame only when something paints; `gif()` flickers a near-invisible pixel
  so the stills before and after the action are captured.
- The devcontainer has no ffmpeg: `gif()` leaves frames in `gifs/.<name>/`, and `encode.sh` runs
  on the host.
- GIFs come out at 200 to 900 KB for a 4 to 9 s action at up to 900 px wide.

## Driving the board

- `press()` sends Enter to a board button by name: a piece standing over a square catches clicks
  and hovers aimed at it. For a hover preview, move the mouse to the button's box centre.
- `choices()` lists the board buttons a tap would choose now; use it to pick a legal square.
- Read crop boxes from the title's own square buttons. Only some squares may have one, and a
  tilted board draws them wider than tall, so read the column and row spacing from those there
  are (the example's `squares()`).
