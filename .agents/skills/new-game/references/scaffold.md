# Scaffold

- Logic: `pnpm turbo gen create-game --args <Name>` inside the dev container works.
- UI: `pnpm turbo gen create-game-ui --args <slug>` fails (`t.choices.find is not a function`: plop cannot bypass a list prompt whose choices are a function). Render `turbo/generators/templates/game/ui/**` yourself: copy every file to `games/<slug>-ui/`, and in `.hbs` files replace `{{kebabCase game}}` and `{{properCase game}}`, turn `\{{` into `{{`, and drop the `.hbs` suffix.
- Copying the latest title's packages from its branch (`git archive <branch> games/<t> games/<t>-ui | tar -x`), then renaming and rewriting, carries every lesson already applied (layout, toggles, history panel, animator, scenario generator) and was faster than the template for YINSH and DVONN. Sweep the copy for the old title's words (`grep -rniE` for its pieces and features) before calling it done.
- The templates predate the coding policy. Before building on them:
  - replace `<GameDefinition<…>>{…}` with `defineGame({ info, runtime })` (see `games/magna-grecia/src/definition/definition.ts`);
  - remove `as` casts (`game.config as …`, `turnOrderSorted … as …`, `gameSession as …`): read config through a pure `fooFromConfig(config)` that falls back to the default, and narrow the session with `assert(gameSession instanceof FooGameSession, …)`;
  - pin `@typescript/native-preview` to the version the sibling games use (the template writes `*`);
  - in `src/app.html`, make the viewport tag `width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover`. Without `maximum-scale=1`, iOS browsers zoom in when a text field under 16px is tapped (the harness's new-game name fields) and stay zoomed through reloads, which clips the table's right edge and hides the bottom of the board under the browser toolbar. Without `viewport-fit=cover`, `env(safe-area-inset-*)` reads 0, so the shared layout cannot clear the home indicator or notch. The template is upstream; fix each title rather than the template;
  - keep the harness page's `UiDefinition as unknown as GameUiDefinition<…>`: every title has it and the readiness checks expect it.
- Delete the template `cover.jpg` once the title has its own cover; a cover can be drawn as SVG and rendered to a 640×640 PNG with the headless browser from `browser-checks.md`.
- Run `pnpm install` in the container after adding packages; the lockfile changes with them.
