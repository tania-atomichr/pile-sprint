# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-14

First public release.

- One card at a time over any page: right keeps, left drops, down is later,
  U undoes, Esc closes. Swipe with a mouse or a finger.
- Nothing changes until Save. Closing early asks to save what you decided.
- Labels per kind of item, so one sprint can mix piles.
- Sources: arrays, JSON, CSV, a URL on your own server, photos picked with a
  file input, and a whole folder of photos (Chrome and Edge).
- Destinations: download as CSV or JSON, a webhook (`pile-sprint/1`), and
  moving files into a "Set aside" folder. Combine them with `both()`.
- Failed saves are named and can be tried again.
- Send from the card: a kind marked `now` runs on right with 3 seconds to
  undo; words are always fully in view first. Editable drafts on the card,
  Ctrl or Cmd + Enter to send.
- `prepare(item)` readies the next three cards while one is read.
- Cards can carry a score, a checklist, a conversation, folded sections and
  a facts line. Labels and icons per kind, as functions of the item; an
  answer can be left out.
- View chips (Mine / Everyone), kind order, a context line, a start button,
  Y/N/S and O keys, confetti on a cleared pile, `onEvent` for usage.
- Demo page with an inbox, photos and a spreadsheet to try.
