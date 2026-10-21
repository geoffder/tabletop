# Scaffold

- Logic: `pnpm turbo gen create-game --args <Name>` inside the dev container works.
- UI: `pnpm turbo gen create-game-ui --args <slug>` fails (`t.choices.find is not a function`: plop cannot bypass a list prompt whose choices are a function). Render `turbo/generators/templates/game/ui/**` yourself: copy every file to `games/<slug>-ui/`, and in `.hbs` files replace `{{kebabCase game}}` and `{{properCase game}}`, turn `\{{` into `{{`, and drop the `.hbs` suffix.
- The templates predate the coding policy. Before building on them:
  - replace `<GameDefinition<…>>{…}` with `defineGame({ info, runtime })` (see `games/magna-grecia/src/definition/definition.ts`);
  - remove `as` casts (`game.config as …`, `turnOrderSorted … as …`, `gameSession as …`): read config through a pure `fooFromConfig(config)` that falls back to the default, and narrow the session with `assert(gameSession instanceof FooGameSession, …)`;
  - pin `@typescript/native-preview` to the version the sibling games use (the template writes `*`);
  - keep the harness page's `UiDefinition as unknown as GameUiDefinition<…>`: every title has it and the readiness checks expect it.
- Delete the template `cover.jpg` once the title has its own cover; a cover can be drawn as SVG and rendered to a 640×640 PNG with the headless browser from `browser-checks.md`.
- Run `pnpm install` in the container after adding packages; the lockfile changes with them.
