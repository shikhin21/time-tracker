# Time Tracker

Local-first macOS desktop app for tracking hours per project, with year / month /
week views, per-project hourly rates, and PDF invoicing (build, preview, and
export invoices from logged hours). See `time-tracker-spec-v1.md` for the v1
specification; invoicing was added after v1 and isn't covered there.

Built with Tauri v2 + React + TypeScript, SQLite (Tauri SQL plugin), and
date-fns for locale-aware week math.

## Quick start

```sh
./setup.sh
```

The script takes a fresh machine from clone to a running app: it checks each
prerequisite below, asks your permission before downloading or installing
anything missing, installs the npm dependencies, and builds and launches the
app in dev mode. Everything after this section is the manual version of the
same steps.

## Prerequisites

- macOS with the Xcode Command Line Tools (`xcode-select --install`)
- Rust via [rustup](https://rustup.rs) (gives `rustc` + Cargo)
- Node.js 20.19+ or 22.12+ (required by Vite 7)

## Development

```sh
npm install
npm run tauri dev
```

The first run compiles the full Rust dependency tree and takes a few minutes;
later runs are incremental. If `rustc` isn't found (shell opened before rustup
was installed), run `export PATH="$HOME/.cargo/bin:$PATH"` first.

The SQLite database is created automatically (migrations run on startup) at
`~/Library/Application Support/com.shikhin.timetracker/timetracker.db`.

## Tests

```sh
npm test
```

Unit tests cover the pure logic core: locale-driven week keys/numbers,
straddling-week splits, totals reconciliation, rate resolution and impact
previews, entry validation, and invoice building / export blockers.

## Release build

```sh
npm run tauri build   # produces .app / .dmg under src-tauri/target/release/bundle
```

The `.dmg` step drives Finder via AppleScript, so on a fresh machine macOS may
prompt for an automation permission; if that step fails, the `.app` bundle is
still produced.
