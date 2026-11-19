<p align="center">
  <img src="assets/logo.svg" width="64" alt="">
</p>

<h1 align="center">/blueprint</h1>

<p align="center">
  Ask Claude Code how something works. It draws the answer like an old patent sheet, one part at a time.
  <br><br>
  <a href="https://blueprint.intincrab.com"><b>Website</b></a> ·
  <a href="https://blueprint.intincrab.com/#examples"><b>All 21 examples</b></a> ·
  <a href="#install"><b>Install</b></a>
</p>

<p align="center">
  <img src="assets/cache.gif" width="880" alt="An animated blueprint sheet explaining a cache: an app asks a database, every request makes the long trip, so a drawer by the door keeps recent answers, and the next request is answered from the drawer">
</p>

Blueprint is a skill for Claude Code. Give it a topic and it returns an animated explainer: parts drawn in with numbered leader lines, things moving along the lines, and one plain sentence per step. It ships as a single `<blueprint-scene>` element or a standalone HTML file, and the finished sheet still explains the idea as a picture.

## Install

```bash
npx skills add intincrab/blueprint
```

Or clone it into your skills folder:

```bash
git clone https://github.com/intincrab/blueprint.git ~/.claude/skills/blueprint
```

It needs Node 18 or later. [Playwright](https://playwright.dev) is optional: it lets Claude render frames of a sheet to check its own work, and it is what the GIF, MP4 and PNG exports run on. To set it up, run this once in the skill folder:

```bash
cd ~/.claude/skills/blueprint     # or wherever the skill was installed
npm i                             # installs playwright@1.56.1 from package.json
npx playwright install chromium   # downloads the browser it drives
```

Linting (`scripts/check.mjs`) and building a page (`scripts/build.mjs`) need nothing but Node.

Offline, or on a distro that ships its own Chromium, skip the download and point the scripts at it: `BLUEPRINT_CHROMIUM=/usr/bin/chromium-browser node scripts/export.mjs …` (works for `frames.mjs` too).

## Use

```
/blueprint how a cache works
/blueprint our signup flow, for the docs page
/blueprint why the retry storm took the API down
/blueprint the event loop, as a complex scene
/blueprint how a cache works, as a gif
/blueprint last night's outage, from this postmortem
```

Claude finds the chain of reasons in the topic, picks parts from a kit of 28 (drawers, cabinets, gears, gates, locks, clocks, queues and more), lays out the sheet, lints it, looks at every step, and then embeds it in your page or exports a file.

## How a sheet is built

Every part has to earn its place. A sheet starts with one real case and adds a part only when the last one falls short:

> The app asks the database for item #42. Every request makes the long trip, and each lookup takes 120 ms. **So** a drawer by the door keeps recent answers. **But** the first time it is empty, **so** it fetches once and keeps a copy. The next request is answered in 2 ms.

That chain of "but… so…" is the explanation, and the animation above is that paragraph drawn.

## Examples

<table>
  <tr>
    <td width="33%"><a href="examples/complex/emudhra.js"><img src="assets/emudhra.png" alt="Finished sheet: the eMudhra key compromise"></a></td>
    <td width="33%"><a href="examples/complex/event-loop.js"><img src="assets/event-loop.png" alt="Finished sheet: the JavaScript event loop"></a></td>
    <td width="33%"><a href="examples/complex/llm.js"><img src="assets/llm.png" alt="Finished sheet: how a language model writes"></a></td>
  </tr>
  <tr>
    <td><b>The eMudhra key compromise</b><br>A real breach from October 2026, for people who are not engineers</td>
    <td><b>The JavaScript event loop</b><br>Stack, task queue and microtasks</td>
    <td><b>How a language model writes</b><br>Tokens, attention, one word at a time</td>
  </tr>
</table>

Watch any of them at **[blueprint.intincrab.com](https://blueprint.intincrab.com/#examples)**, where you can step through each one and copy its source.

| Small · 3–6 steps | Complex · 8–10 steps, with camera moves |
|---|---|
| [How a cache works](examples/small/cache.js) | [The eMudhra key compromise](examples/complex/emudhra.js) |
| [Debouncing a search box](examples/small/debounce.js) | [What happens when you open a web page](examples/complex/url.js) |
| [A token bucket rate limiter](examples/small/rate-limit.js) | [How git merges two branches](examples/complex/git-merge.js) |
| [A job queue absorbing a burst](examples/small/queue.js) | [How "Sign in with Google" works](examples/complex/oauth.js) |
| [The call stack](examples/small/call-stack.js) | [How a database survives a crash](examples/complex/transaction-log.js) |
| [A hash map finding a key](examples/small/hash-map.js) | [How a CDN brings files closer](examples/complex/cdn.js) |
| [Retry with exponential backoff](examples/small/retry-backoff.js) | [The JavaScript event loop](examples/complex/event-loop.js) |
| [A load balancer spreading work](examples/small/load-balancer.js) | [An event log with partitions](examples/complex/kafka.js) |
| [A database index finding a row](examples/small/db-index.js) | [A circuit breaker](examples/complex/circuit-breaker.js) |
| [A lock stopping lost updates](examples/small/mutex.js) | [How a compiler turns text into a program](examples/complex/compiler.js) |
| | [How a language model writes](examples/complex/llm.js) |

## Put it on a page

```html
<blueprint-scene scene="cache" play="view" key></blueprint-scene>
<script src="/blueprint/blueprint.js" defer></script>
<script src="/blueprint/cache.js" defer></script>
```

| Attribute | What it does |
|---|---|
| `play` | `loop` (default), `view` (plays once when scrolled into view), `click`, or `still` (the finished sheet) |
| `paper` | `blue` (cyanotype, default) or `linen` (ink on cream) |
| `key` | Shows the numbered parts list under the sheet |
| `no-controls` | Hides the play, step and replay bar |
| `speed` | Playback rate of the motion, e.g. `1.25`; rests stay in real time so captions keep their reading time |
| `no-font` | Uses the reader's own monospace font instead of fetching IBM Plex Mono from Google Fonts |

Load `blueprint.js` before the scene files; `defer` keeps that order. If a scene can't be found (a misspelled `scene`, or its file loaded before the runtime), the element says so in the sheet's place and in the console.

Every sheet has play and pause, previous and next step, and a step bar. With reduced motion turned on it shows the finished sheet. The runtime is one file with no dependencies. By default it loads IBM Plex Mono from Google Fonts; add `no-font` (or pass `--no-font` to `build.mjs` and `export.mjs`) and the page makes no outside requests.

## Share it as a GIF, video or image

GitHub READMEs, Slack, X, Notion and slide decks can't run the element, so export the sheet:

```bash
node scripts/export.mjs examples/small/cache.js --format gif            # loops in a README or Slack
node scripts/export.mjs examples/small/cache.js --format mp4            # for X or a talk; add --audio track.mp3
node scripts/export.mjs examples/small/cache.js --format png            # the finished sheet at 2x
node scripts/export.mjs examples/small/cache.js --format png --steps    # one image per step, for slides
node scripts/export.mjs examples/small/cache.js --format all --out out/cache.png   # out/cache.png, .gif, .mp4
```

Or just ask: `/blueprint how a cache works, as a gif`. Exporting needs Playwright (see [Install](#install)). `--out` ending in `.png`, `.gif` or `.mp4` names the files (each format keeps its own extension, and `--steps` adds `-01`, `-02`…); any other `--out` is a folder. A file with several scenes exports the first; pick another with `--scene <id>`.

MP4 needs an encoder. With [ffmpeg](https://ffmpeg.org) on your PATH it uses that, with libx264, or libopenh264 where ffmpeg has no libx264 (Fedora's build). Without ffmpeg, Chromium encodes the video itself (WebCodecs) and the script writes the MP4, so on macOS nothing else is needed (Windows should work the same way, but is untested). That needs the full Chromium, which `npx playwright install chromium` downloads alongside the headless shell. On Linux, Playwright's Chromium has no H.264 encoder, so install ffmpeg (`apt install ffmpeg`, `dnf install ffmpeg-free`), or point `BLUEPRINT_CHROMIUM` at a distro Chromium that has one (Fedora's does). Such a Chromium may still lack AAC; then `--audio` needs ffmpeg, and the script says so before it renders anything. `--encoder ffmpeg` or `--encoder browser` picks one. With `--audio`, the video sets the length: a shorter track ends in silence, a longer one is cut.

A scene's `sources` (the links behind an incident sheet) are not drawn into GIFs, videos or images. Put them in the post, the slide notes or the README next to the export. `scripts/build.mjs` lists them under the sheet.

## Incidents and postmortems

`templates/incident.js` gives an outage a ready-made story: a normal day, the change, what broke, how it was noticed, the fix that stopped it, the root cause, and the change that prevents it next time, ending on a timeline. Hand Claude your postmortem and it fills the template with your facts, links the sources, and keeps the wording blameless. [The eMudhra key compromise](examples/complex/emudhra.js) shows the same shape for a public incident.

## One HTML file

To send a sheet to someone as a single file:

```bash
node scripts/build.mjs examples/small/cache.js --out cache.html
node scripts/build.mjs a.js b.js --out explainers.html --title "How our API works" --play view --paper linen
```

The page inlines the runtime and every scene, and lists each scene's `sources` as links under it.

## What is in the repo

| Path | Purpose |
|---|---|
| `SKILL.md` | What Claude reads first: the workflow and the style rules |
| `references/craft.md` | The scene format, the part kit, line kinds, step actions, and which part suits which idea |
| `runtime/blueprint.js` | Layout, timeline, SVG renderer and the `<blueprint-scene>` element |
| `templates/scene.js` | A starting scene |
| `templates/incident.js` | A starting scene for incidents and postmortems |
| `scripts/check.mjs` | Lints a scene: unknown ids, empty scenes, parts no step draws, overlapping parts, lines through parts or text, text on a zone's border, gates that swing into things, ✓/✕ badges on text, labels off the sheet |
| `scripts/frames.mjs` | Renders chosen moments into one contact sheet (needs Playwright): `node scripts/frames.mjs scene.js --out sheet.png` |
| `scripts/build.mjs` | Turns scenes into one standalone HTML page |
| `scripts/export.mjs` | Exports a scene to GIF, MP4 or PNG |
| `scripts/lib/` | The GIF encoder, the PNG decoder, the MP4 writer and browser encoder, and the helpers for inlining code into a page |
| `package.json` | npm scripts (`npm run check -- scene.js`, `build`, `frames`, `export`) and the pinned Playwright |
| `examples/` | 10 small and 11 complex scenes |
| `assets/` | The logo and the README's GIF and stills |
| `gallery/` | Every example on one self-contained page, built with `node gallery/build.mjs` |
| `site/` | The website, built with `node site/build.mjs` into `site/dist` (page, share card, robots.txt, sitemap.xml, vercel.json headers) |
| `video/` | The teaser film and the scripts that render it and the README preview |

## Where the look comes from

Victorian patent drawings for the fine line work, numbered parts and shading. Randall Munroe's *Thing Explainer* for plain words and labels on everything. Bartosz Ciechanowski's explainers for building a machine one part at a time. Bret Victor's *Ladder of Abstraction* for showing one concrete case before the rule. And Kamran Ahmed's [/stick-scene](https://github.com/nilbuild/stick-scene), which this skill's packaging follows.

## License

[MIT](LICENSE). Scenes you make with the skill are yours.
