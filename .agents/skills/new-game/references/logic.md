# Logic

- Model a move the player makes in several clicks as several Actions with machine states between them (place, then remove; each jump of a chain; push, then take a row). Undo then steps back one click at a time, and history can group them.
- An Action's `metadata` is the only record history, the waiting view and animation get. Record every fact they will show or animate, including what a system effect took: claimed rings with their marbles, removed pieces with owner and kind, the line a push moved and how many pieces shifted, whether a jump chain continues. Missing metadata later means rewriting history code against patches, which the coding policy forbids.
- Put rule arithmetic on the state and board models, not in handlers: free/removable checks, jumps, rows and their reach, group isolation, win checks.
- Tests, in `src/definition/game.spec.ts`:
  - one test per rule decision from step 1, driving the real `GameEngine.executeCanonicalAction`;
  - a position helper that rewrites the started state (board, pool, captures) so each rule is tested in a few pieces;
  - **random playouts**: a legal-action generator for every machine state, a seeded chooser, 10–15 games per variant, asserting a single result within a step cap. They catch deadlocks and invalid states no hand-written test reaches.
- Keep a title's choices that are not rules (default light board, show coordinates, ripple water) in a `TitlePreferenceDefinition`, not in Game config. Adding a key with a default needs no version bump; a saved explicit choice still overrides the new default, which looks like a bug to the user ("the default should be light") until they toggle once.
