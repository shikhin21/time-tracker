# Project Time Tracker — v1 Specification

A local-first desktop application for tracking hours spent on projects, with year, month, and week views and per-project hourly rates. Built for a single user on macOS, with a data model designed to add cloud sync and backup later without migration.

---

## 1. Scope and goals

Track time spent per project by logging daily hours, and view totals rolled up by week, month, and year. One user, one machine (macOS) for v1. Cloud sync, backup/export, invoicing, and charts are explicitly **out of scope for v1** but the data model must not need to change to add them later.

### In scope (v1)
- Multiple open-ended projects, each with a name and a color.
- Per-project hourly rates with arbitrary effective dates (stored, displayed, editable — **not** used in any calculation yet).
- Logging hours against a project on a given day, with multiple entries per day and an optional free-text task per entry.
- Three views, scoped to a single project at a time: **year** (read-only, tappable), **month** (editable), **week** (editable, reached by drill-down).
- Weekly / monthly / yearly totals computed on the fly.

### Out of scope (v1, but must remain additive later)
- Cloud sync.
- Backup / export / import.
- Invoicing and any cost calculation (rate × hours).
- Charts / graphs.
- Cross-project / all-projects views.
- Project archival.
- Light/dark theme switching (see §9 — palette is defined for both, only light is wired up).
- Task as a grouping dimension. (Task **type-ahead** is in scope — see §5.)

---

## 2. Technology stack

- **Framework:** Tauri (native macOS app; single process hosting the OS webview with a Rust core, communicating over Tauri's in-process command bridge — no localhost server).
- **Frontend:** React + TypeScript.
- **Local storage:** SQLite, via the official Tauri SQL plugin.
- **Date library:** `date-fns` with locale support, for locale-aware week start and week/month/year math. The locale is **detected from the system** (not hardcoded); e.g. a US-locale system gets Sunday-start weeks, a German-locale system Monday-start.
- **Target build:** macOS `.dmg` / `.app`. (Builds are produced on the OS they target; macOS only for v1.)

### Dev environment (macOS)
- VS Code + `rust-analyzer` + the official Tauri extension + ESLint/Prettier.
- Rust toolchain via `rustup` (gives `rustc` + Cargo).
- Node.js (LTS) + npm (or pnpm).
- Tauri CLI (as a project dependency).
- Xcode Command Line Tools (`xcode-select --install`).

---

## 3. Data model

All primary keys are **client-generated UUIDs** (not auto-increment) so records created offline on multiple devices never collide — this is what keeps later sync additive. Every row that can be edited carries an `updatedAt` timestamp for last-write-wins conflict resolution later.

### Date storage convention (important)
Two different kinds of "date" exist in this model and are stored differently on purpose:

- **Calendar dates** — answer "which day did this happen?" Stored as **`"YYYY-MM-DD"` strings**, with no time and no timezone. This is `entries.date` and `rates.effectiveDate`. Storing these as epoch instants would let timezone/DST shifts move an entry to the wrong calendar day and mis-bucket totals; strings avoid that entirely and sort correctly.
- **Machine timestamps** — answer "when was this row written?" Stored as **epoch milliseconds**. This is `createdAt` / `updatedAt`. These are true instants, never grouped into calendar buckets, and exist for sync ordering.

### Tables

```
projects
  id           uuid            -- primary key, client-generated
  name         string
  color        string          -- token name from the fixed palette (§9), not raw hex
  createdAt    number          -- epoch ms
  updatedAt    number          -- epoch ms

entries
  id           uuid            -- primary key, client-generated
  projectId    uuid            -- FK -> projects.id
  date         string          -- "YYYY-MM-DD", the calendar day worked
  hours        number          -- positive, multiple of 0.25
  task         string?         -- optional free text
  createdAt    number          -- epoch ms
  updatedAt    number          -- epoch ms

rates
  id            uuid           -- primary key, client-generated
  projectId     uuid           -- FK -> projects.id
  effectiveDate string         -- "YYYY-MM-DD"
  rate          number
  createdAt     number         -- epoch ms
  updatedAt     number         -- epoch ms
  UNIQUE (projectId, effectiveDate)
```

### App preferences (persisted app state, outside the data tables)
- `lastSelectedProjectId` — the project the app reopens to. Stored as lightweight app state (e.g. a small key-value store / preferences file), not in the relational tables.

---

## 4. Projects

- Projects are open-ended: the user can create as many as they like.
- Each project has a **name** and a **color** chosen from the fixed palette (§9). The color hues that project's views.
- On **project creation**, the user is prompted for an initial **hourly rate**. The prompt is **optional (skippable)** — if given, the rate is written to the `rates` table with `effectiveDate` = the creation date, and applies from that date forward (§6); if skipped, the project simply has no rates and all days resolve to "no rate set" (§6).
- No archival in v1 (projects can be created; archival/hide is a later feature). **No project deletion in v1.**
- The app always opens **scoped to a single project** — the last selected one (`lastSelectedProjectId`). Switching projects re-scopes all views to that project.

---

## 5. Entries (logging hours)

- The user logs **hours typed directly** (not start/end times).
- Hours are in **0.25 (quarter-hour) increments**. The input **enforces** this — values are snapped/rejected to the nearest valid quarter-hour; non-quarter values are not accepted.
- **Multiple entries per day per project** are allowed. Each entry has its own `hours` and optional `task`.
- Each entry may carry an **optional free-text task** label. Task is a label only — it is **not** a grouping dimension — and has **no length cap**. The task field is a **type-ahead**: as the user types, it **fuzzy-matches the current project's previous task labels** (most recent first) and offers them as suggestions; picking one fills the field, but any free text remains valid.
- **Validation:**
  - Each entry's `hours` must be **non-negative** (an explicit `0` is a valid entry — see below) and a multiple of 0.25.
  - The **sum of all entries on a given day** (within a project) must be **≤ 24**. Adding/editing an entry that would push the day's total over 24 is rejected.

### Empty vs. explicit zero
- A day the user has **not touched** shows **empty** and contributes nothing to any total (`undefined`, treated as 0 for totals but visually blank).
- An **explicit 0** entered by the user is a deliberate entry, shown as `0`, and also contributes nothing to totals.
- These two states are visually distinct (blank vs. `0`) but numerically identical (both add nothing). This mirrors the rate "no rate set" vs. "$0" distinction (§6).

---

## 6. Hourly rates

Rates use a **rate-effective-date** pattern with **arbitrary effective dates**.

### Resolution rule
The rate in effect for any given day is **the rate row (for that project) whose `effectiveDate` is the latest date ≤ that day**. A rate set on a date carries forward to all later days until a newer rate row supersedes it.

- Days **before the project's first `effectiveDate`** resolve to **no rate** ("—", displayed as "no rate set", never "$0"). This is exactly the "hours logged in the past → no rate" case, and it falls out of the model with no special handling.

### Managing rates
- Rates are viewed and edited in a **per-project rate section** in the project's settings/header — not inside the month/week grid.
- The section shows the **current effective rate** (resolved as of local today) and allows **adding a new rate with an effective date**, and editing/deleting existing rate rows. Editing a row may change its **value and/or its `effectiveDate`**.
- **One rate per (project, effectiveDate):** setting a rate on a date that already has a rate **edits that existing row** rather than creating a second (enforced by the `UNIQUE (projectId, effectiveDate)` constraint). Editing a row's `effectiveDate` onto a date that already has a rate for that project is **rejected with a stated reason** (no merge).
- **Rate values** are **non-negative** with at most **two decimal places**, displayed in **$** (no currency column; single-currency v1).

### "Show what's affected" (required)
Because resolution is retroactive, changing rate history can silently change the effective rate for a span of already-logged days. Before committing a change, the UI must **show the impact**:
- **Adding** a rate with an effective date in the past → show the range of dates / count of entries whose effective rate changes as a result, and confirm.
- **Editing** an existing rate row (its value and/or its `effectiveDate`) is equally retroactive → same impact preview and confirm.
- **Deleting** a rate row → show that the affected span shifts onto the previous rate (or to "no rate" if it was the first), and confirm.
- Deleting the **first** rate → make explicit that the project now has no rate before the next effective date.

### v1 constraint
Rate is **stored, displayed, and editable only**. **No cost is calculated or shown anywhere** in v1 (no rate × hours). "No rate set" renders as "—", distinct from a rate of 0.

---

## 7. Views

All views are **scoped to one project at a time**. Switching projects re-scopes all views. Week start is **locale-aware**, following the system locale (e.g. US locale → Sunday start); week **numbers** are likewise locale-driven (`getWeek`-style, **not** ISO).

**Saturday and Sunday cells** are subtly marked as off days in all three views (a dedicated semantic tint token with light + dark values): month and week views tint the whole cell; the year view draws a small tinted **circle behind the date number** (whole-cell tint is too heavy at that density).

Navigation hierarchy (drill down and back up the same chain):

```
Year  --tap month-->  Month  --tap week-->  Week  --tap day-->  Day detail panel
  \                     \--------------- tap day ------------->  Day detail panel
   \------------------------------------ tap day ------------->  Day detail panel
```

The **day detail panel** (drawer / inline expander) is a **single shared component**, opened by tapping a day in any view (year, month, or week). It is the only editable surface for entries.

### 7.1 Year view (read-only, tappable)
- Calendar-style layout (like a Google Calendar yearly view): months laid out in a grid; within each month, weeks are rows of seven day cells; a **week-number column** on the left. Each month mini has a **header row**: week-number column ("Wk"), locale-ordered weekday initials, and the hours/totals column ("Hrs").
- **Day cells are plain** (no heatmap, no per-day numbers required beyond the date), but **tappable**: tapping a day opens the shared **day detail panel** (§7.4) — same as from the month and week views.
- **Weekly total at the right edge** of each week row (ledger style).
- **Month total shown below** that month's weeks (near/under the weekly totals column).
- The year grid itself is **not editable** (edits happen only through the day detail panel). Tapping a **month** drills into the month view.
- Week-number column is shown (per the reference layout).
- For straddling weeks in the year view, weekly totals follow the same month-contribution logic as elsewhere (see §8), consistent with the month view.

### 7.2 Month view (editable — "Option A")
- Calendar grid: weeks as rows, seven day columns, **weekly total at the right edge of each row**, **month total at the bottom**. Mirrors the year view's ledger style.
- Each **day cell shows its per-day total** (blank if the day is untouched — §5).
- **Editing happens via the day detail panel:** tapping a day opens the shared detail panel for that day, where the user adds / edits / deletes entries and sets each entry's optional task.
- Tapping a **week** (e.g. the week-number or row) drills into the week view.
- **Cross-boundary weeks** (a week straddling two months): show the **whole week row** with out-of-month days **greyed/dimmed**. The **weekly total on that row counts only the in-month days**. The **month total counts only in-month days**. (See §8 for how this reconciles with the week view.)

### 7.3 Week view (editable, drill-down)
- Reached by tapping a week from the month view (or year view drill path).
- Shows the seven days of that week; tapping a day opens the **same shared day detail panel** (add/edit/delete entries, set task).
- **Week total display:**
  - **Non-straddling week:** a single total.
  - **Straddling week:** the total is **split by month**, with a **labeled subtotal per calendar month the week touches** (always one or two months — a 7-day week cannot span three). Subtotals are ordered **chronologically (earlier month first)**. Example: `Dec: 12.5h · Jan: 6.0h`.
  - **Year-boundary weeks** (Dec/Jan): include the **year** in the label when the week crosses a year boundary, so it is unambiguous (e.g. `Dec 2026 · Jan 2027`). Elsewhere the year is omitted as redundant.

### 7.4 Day detail panel (shared component)
- Opened from the year, month, or week view by tapping a day.
- **Tapping today's date** (in any view) additionally opens a **quick-add bubble** — a popover with a tooltip arrow pointing at the tapped cell, containing the same add-entry editor — since tapping today usually means "log an entry now". Saving or dismissing the bubble leaves the panel open; other days get no bubble.
- Lists that day's entries for the current project; each entry shows hours and optional task.
- Supports **add / edit / delete** entries, editing hours (enforced quarter-hour) and the optional free-text task.
- Enforces the day's **≤ 24h** total (§5).

### 7.5 Navigation controls
- A **"Today"** control and **prev/next arrows** are present in each view.
- **Year view:** arrows move by year; "Today" jumps to the current year.
- **Month view:** arrows move by month; "Today" jumps to the current month.
- **Week view:** arrows move by week; "Today" jumps to the week containing today.
- In **all three views**, "Today" also **opens the day detail panel for today**; if another day's panel is already open, it switches to today.
- On open, the app lands on the last selected project, in the **month view of the current month**.
- **First launch with zero projects** → the create-project flow (the app is unusable without at least one project).

---

## 8. Totals and cross-boundary reconciliation

Totals are **always computed on the fly** from `entries` — never stored. The dataset is small (thousands of rows over years); grouping is done in JS/SQL by day, week key, `YYYY-MM`, and year. The **week key is locale-driven, not ISO**: it is the week's start date as `"YYYY-MM-DD"` (computed via locale-aware `startOfWeek`), so grouping always matches what the views display.

The one subtlety is a **week that straddles two months (or years)**. The rule that keeps every view internally consistent:

- A straddling week's hours are **split by whichever month each day falls in.**
- **Month view** (and year view) show, for that week's row, the **in-month contribution only** (the days belonging to the month being displayed). The **month total sums in-month days only** → month totals are always exact.
- **Week view** shows the **per-month breakdown** — a labeled subtotal for each month the week touches (§7.3).

Because the week view shows each month's contribution *separately* rather than one blended 7-day number, **no view contradicts another**: the in-month subtotal shown in the week view for (say) December is the same number the December month view shows for that week's row. They agree by construction.

**Totals granularity:** since all views are single-project, every total is a per-project figure (weekly, monthly, yearly). No cross-project or grand totals in v1.

---

## 9. Theming and color

Two distinct color concerns, both defined in a **single source-of-truth token file**, with **light and dark values defined but only light wired up** in v1.

### 9.1 Semantic UI tokens
- Named tokens (e.g. `background`, `surface`, `textPrimary`, `textSecondary`, `border`, etc.), each with a **light and a dark value** defined in the token file.
- Components reference **token names only** — never raw hex.
- v1 uses the **light** set. Switching to a real theme later is flipping which set the tokens resolve to (plus optionally following the macOS system setting), with **no component changes**.

### 9.2 Project color palette
- A **small fixed palette** (~8 distinct, legible hues) the user picks from when creating/editing a project.
- Defined as its **own set of tokens**, each carrying **light- and dark-appropriate values** (so a color chosen now stays legible against a dark background later) — **not** raw hex used directly in components.
- The chosen project color hues that project's views.

---

## 10. Forward-compatibility guarantees

These are the choices that keep deferred features **additive** (no schema migration, no rework):

- **UUID primary keys** → multi-device offline creation never collides → cloud sync is additive.
- **`updatedAt` (epoch ms) on editable rows** → last-write-wins conflict resolution is ready.
- **Calendar dates as `"YYYY-MM-DD"` strings** → week/month/year bucketing is timezone-safe and stable across machines.
- **Local SQLite file** → backup/export is a pure read over existing data (copy the file, or dump to JSON/CSV). No columns added, no schema change. Import/sync later relies on the stable UUIDs + `updatedAt` already present.
- **Rate as `(projectId, effectiveDate, rate)` rows** → invoicing/cost later is a pure read (resolve rate per day, multiply) with no model change.
- **Single-project views over a relational store** → a cross-project view later is purely additive (query across projects; no restructuring).
- **Palette/token file with light+dark defined** → theme switching is a resolution flip, not a component rewrite.

**Known accepted limitation:** v1 uses **hard deletes** (entries, rate rows) with no tombstones. Rows deleted before sync ever exists are simply gone, which is fine for a single-user app; if sync lands later, a nullable `deletedAt` column can be added additively at that point.

---

## 11. Open items intentionally deferred to build time

These are implementation details, not requirements gaps — left to the build session:

- Exact palette hex values for the ~8 project colors and the light/dark semantic tokens.
- Precise layout / responsive behavior of the year grid on smaller windows.
- Whether the day detail panel is a side drawer vs. inline expander (either satisfies the spec; pick during UI build).
- Keyboard shortcuts / fast-entry ergonomics for the day detail panel (nice-to-have).
