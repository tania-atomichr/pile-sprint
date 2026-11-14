# Contributing

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Before you start

- **Small fix?** Open a pull request straight away.
- **New source, destination or a bigger change?** Open an issue first so we
  can agree on the shape before you spend time on it.
- **Security problem?** Do not open a public issue. See [SECURITY.md](SECURITY.md).

## Set up

No build step: Pile Sprint is plain JavaScript and CSS.

1. Fork and clone the repository.
2. Run `npm run serve` (or any static server) and open
   <http://localhost:8080>. Opening a folder of photos needs `localhost` or
   https, not a `file://` page.

## Run the tests

```sh
npm install
npx playwright install chromium
npm test
```

`test/unit.mjs` checks the decisions, sources and destinations in Node.
`test/e2e.mjs` drives the demo page in real Chromium: keys, swipes, undo,
saving, a failed save, a CSV, and the phone width. Screenshots land in
`test/out/` (ignored by git). Every pull request runs both on GitHub.

To redraw the README pictures: `DOCS=1 node test/e2e.mjs`, and for the GIF
`node scripts/demo-frames.mjs && python3 scripts/frames_to_gif.py` (needs
Pillow).

## What we look for in a pull request

- **One change per pull request**, with a short description of what it does
  and how you checked it. Add screenshots for anything you can see.
- **The tests pass**, and a new behaviour gets a check.
- **Nothing changes before Save.** Answers are only recorded until the
  person presses Save, and every press can be undone.
- **Text is text.** Anything from a pile is escaped on the card. Only a
  custom `render` the host page writes may return HTML.
- **Nothing is deleted.** Destinations that touch files move them; they do
  not remove them.
- **Talking to another system goes through `src/destinations.js`** (and
  loading from one through `src/sources.js`). Add one there rather than a
  `fetch` somewhere else.
- **The `pile-sprint/1` format is a contract.** A change to what the webhook
  and the JSON download send must stay backwards compatible, or bump it to
  `pile-sprint/2` and say so in [CHANGELOG.md](CHANGELOG.md).

## Code style

- Plain ES5-style JavaScript in `src/`, no dependencies, no build step, so
  anyone can read and load the source as is.
- Two-space indent (see `.editorconfig`).
- Comments explain *why*, not *what*.
- Words on screen are plain and in sentence case: "Close without saving", not
  "CANCEL" or "Discard changes?".

## Releases

1. Update `VERSION` in `src/core.js` and `version` in `package.json`.
2. Add a section to [CHANGELOG.md](CHANGELOG.md).
3. Tag the commit `vX.Y.Z` and create a GitHub release.

By contributing you agree that your contribution is licensed under the
[MIT License](LICENSE), and to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
