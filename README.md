# Time Tracker

Local-first macOS desktop app for tracking hours per project, with year / month /
week views and per-project hourly rates (stored and editable; no cost math in v1).
See `time-tracker-spec-v1.md` for the full specification.

Built with Tauri v2 + React + TypeScript, SQLite (Tauri SQL plugin), and
date-fns for locale-aware week math.

## Development

```sh
npm install
npm run tauri dev
```

If `rustc` isn't found (shell opened before rustup was installed), run
`export PATH="$HOME/.cargo/bin:$PATH"` first.

The SQLite database lives at
`~/Library/Application Support/com.shikhin.timetracker/timetracker.db`.

## Tests

```sh
npm test
```

Unit tests cover the pure logic core: locale-driven week keys/numbers,
straddling-week splits, totals reconciliation, rate resolution and impact
previews, and entry validation.

## Release build

```sh
npm run tauri build   # produces .app / .dmg under src-tauri/target/release/bundle
```
