---
name: new-game
description: Build a new game title end to end — rules decisions, logic and UI packages, history, animation, harness scenarios and browser checks. Use when asked to add, implement or port a board game, to keep building one already started, or to rework a finished title's board or animation.
---

# Build a new game

The architecture lives in `docs/DESIGN.md`, the table layout in `docs/game-ui-layout.md`, staged selection in `docs/user-interactions.md`; this skill is the order of work and the **lessons** earlier titles paid for. Read each reference file below when its step starts, before writing that step's code.

## Steps

1. **Settle the rules.** Read the rules from the publisher's own pages, then put every open choice to the user in one batch: which versions or variants to offer and which is the default, any option the rules make optional, and edge cases the rules leave out. Offer a recommended answer for each. Done when every choice has an answer and the answers are recorded where later sessions will find them.
2. **Scaffold.** Follow [`references/scaffold.md`](references/scaffold.md). Done when both packages type-check and the empty harness opens.
3. **Logic.** Follow [`references/logic.md`](references/logic.md). Done when every rule decision from step 1 has a test and random playouts of every variant end with a result.
4. **Table UI.** Follow [`references/ui-lessons.md`](references/ui-lessons.md) on top of `docs/game-ui-layout.md`; for a board seen from the side of the table, also [`references/tilted-view.md`](references/tilted-view.md). Done when a full turn plays in the harness at desktop and phone sizes and the board's position is identical across your turn, the waiting view and history view.
5. **Animation.** Load the `game-ui-animation` skill, then apply [`references/animation-lessons.md`](references/animation-lessons.md). Done when every lesson's check passes.
6. **Scenarios.** Use the `add-harness-scenario` skill for each position worth opening directly (near a win, multi-step captures, rare rule cases). For each way the game ends, give the position a near miss as well as the ending (YINSH: the last marker ends the game, unless it completes a row and refills the pool). Done when each scenario's claims were played through the engine and its README entry written.
7. **Check in a browser.** Follow [`references/browser-checks.md`](references/browser-checks.md) after every visible change, and look at the screenshots yourself before reporting. Done when the screenshots show what you are about to describe.
8. **Measure on phone stand-ins.** Follow [`references/performance.md`](references/performance.md) once a full turn plays, and again after any change to how pieces are drawn or animated. Done when opening and a move meet its targets in Chromium slowed 4× and in WebKit.
9. **Register** the title in `config/config-games/src/games.json`.

## Reworking a finished title

Read the reference files for the parts being changed and check the title against each lesson whose symptom it could show; later titles' lessons often apply to earlier ones. The GIPF project titles (GIPF, YINSH, DVONN, LYNGK, ZÈRTZ, TZAAR, MATRX GIPF) all use the tilted view (`references/tilted-view.md`); keep a rework consistent with it. Then apply steps 5–8 to what changed.
