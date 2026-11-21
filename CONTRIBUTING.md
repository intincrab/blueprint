# Contributing to Blueprint

Thanks for helping. Blueprint is small on purpose: one runtime file with no dependencies, scenes as plain data, and a skill file that teaches Claude to write them. Contributions that keep it that way are the easiest to merge.

Good things to send:

- **A scene** for the examples: one mechanism, explained "but… so…".
- **A fix** to the runtime, the lint or the export scripts.
- **A new part** for the kit, when no existing part makes a good picture of something common.
- **Docs**: a clearer sentence in `SKILL.md` or `references/craft.md`, or a mistake worth adding to craft.md's list.
- **A bug report** with the scene file, the command you ran, what you expected and what happened. Say which OS and browser.

For anything bigger (a new feature, a change to the scene format), open an issue first, so we can agree on the shape before you write it.

## Set up

You need Node 18 or later. Linting and building pages need nothing else.

```bash
git clone https://github.com/intincrab/blueprint.git
cd blueprint
npm i                             # Playwright 1.56.1, for frames and exports
npx playwright install chromium
```

Playwright is only needed to render frames and exports. If you'd rather not download a browser, point the scripts at one you have: `BLUEPRINT_CHROMIUM=/usr/bin/chromium-browser`.

## Where things are

| Path | What it is |
|---|---|
| `runtime/blueprint.js` | The whole runtime: layout, timeline, SVG drawing, controls and the `<blueprint-scene>` element |
| `scripts/check.mjs` | The lint: ids, overlaps, lines through text, caption length and reading time, links |
| `scripts/frames.mjs` | Renders chosen moments of a scene into one contact sheet PNG |
| `scripts/export.mjs`, `scripts/build.mjs` | GIF, MP4 and PNG exports; a standalone HTML page |
| `SKILL.md`, `references/craft.md` | What Claude reads: the workflow, the style rules and the scene format |
| `examples/`, `templates/` | The example scenes and the starting points |
| `site/`, `gallery/`, `video/` | The website, the one-page gallery, the README media |

## Check your work

Every pull request should pass these:

```bash
node scripts/check.mjs examples/*/*.js templates/*.js
node scripts/frames.mjs path/to/scene.js --out /tmp/scene.png
```

- `check.mjs` must exit 0. Fix the warnings your change causes. If an overlap is deliberate, say why in a comment in the scene.
- Open the `frames.mjs` PNG and look at it. Most layout problems only show up in the picture: a label on a line, a token in the wrong place, a cropped numeral.
- If you touched the runtime, check that the existing examples still look the same, and play one in a browser: `node scripts/build.mjs examples/small/cache.js --out /tmp/cache.html`.
- If you touched an export, run it once per format you changed and open the file.

## Adding a scene

1. Start from `templates/scene.js`. Read `references/craft.md` first: it has the format, the kit and the mistakes already made.
2. Follow the style rules in `SKILL.md`: one concrete case first, "but… so…", numbered parts, plain words, one caption per step.
3. Small scenes go in `examples/small/` (3–6 steps), complex ones in `examples/complex/` (7–10 steps, with camera moves).
4. Lint it clean and look at the frames.
5. For the website, add the scene's id to `META` in `site/build.mjs` with the prompt that would make it and a few search words. Add it to the table in `README.md` too.

Facts in a scene must be right. For anything real (an incident, a protocol, a number), put the sources in the scene's `sources`.

## Adding a part

Parts live in `KINDS` in `runtime/blueprint.js`. Each has a default `size`, a `draw(w, h, p)` that returns SVG markup for a box from (0, 0) to (w, h), and optionally `upd(k, w, h, S)` for live state, `state` (the keys `set` may change) and `labelAt`. Copy a similar part and change it.

- Draw with the helpers (`ln`, `sh`, `thin`, `circ`, `pf`, `housing`) so the line work draws in like the rest.
- New per-part options go in `PART_EXTRA`, so the lint knows them.
- Document the part in the kit table in `references/craft.md`, and say what it is good for.
- Add or change an example that uses it, and look at it at several steps.

## Rules for the runtime

- **No dependencies and no build step.** `runtime/blueprint.js` is served as written, from a CDN or a docs folder. Keep it one file.
- **Match the style around you.** It is plain ES5-style JavaScript (`var`, functions), so it runs anywhere without transpiling. The custom element is the one class.
- **Scenes are untrusted data.** Pages paste JSON scenes from anywhere. Escape every string that reaches markup with `esc()`, check every value that reaches an attribute (see `COLOR_RE`, `ID_RE`), and never `eval` anything from a scene.
- **Keep the timeline and the lint in step.** `check.mjs` reads the runtime's own `layout()` and `compile()`. If you change where something is drawn, the lint should still measure it correctly.
- **Existing scenes must not change** unless that is the point of the change. Say so in the pull request if they do.

## Pull requests

- One change per pull request, with a short description: what was wrong, what you changed, and how you checked it (commands, OS, browser). Screenshots or frames help a lot for anything visual.
- Say what you didn't test. "Ran on macOS only" is useful to know.
- **To show up as a contributor**, commit with an email linked to your GitHub account. GitHub credits commits by email, so an email it doesn't know makes the commit anonymous. Your private noreply address works: `git config user.email "<id>+<username>@users.noreply.github.com"` (find it under GitHub → Settings → Emails).

## License

By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE), like the rest of the project.
