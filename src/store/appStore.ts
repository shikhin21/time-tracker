import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import type { ProjectRow } from "../db/db";
import * as projectsRepo from "../db/projectsRepo";
import * as settingsRepo from "../db/settingsRepo";
import { getDb } from "../db/db";
import {
  addMonthsKey,
  addWeeksKey,
  initLocale,
  monthKeyOf,
  todayKey,
  weekKeyFor,
  yearOf,
} from "../lib/dates";
import {
  applyProjectAccent,
  applyTheme,
  resolveThemeMode,
  type ThemeMode,
  type ThemePreference,
} from "../theme/applyTheme";

export type ViewKind = "year" | "month" | "week";
export type AppStatus = "loading" | "onboarding" | "ready" | "error";

/** Viewport rect of the tapped day cell (structurally DOMRect-compatible). */
export interface AnchorRect {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

interface AppState {
  status: AppStatus;
  error: string | null;
  projects: ProjectRow[];
  currentProjectId: string | null;
  view: ViewKind;
  /** A date key inside the currently viewed period; the view derives its
   *  year / month / week from it. */
  anchorKey: string;
  selectedDayKey: string | null;
  /** Quick-add bubble state: set only when *today's* cell is tapped. */
  quickAdd: { dateKey: string; anchor: AnchorRect } | null;
  settingsOpen: boolean;
  /** App-level (not per-project) display theme. */
  themePreference: ThemePreference;
  /** themePreference resolved against the OS setting when it's "system". */
  themeMode: ThemeMode;
  /** Bumped after every mutation; data hooks refetch on change. */
  dataVersion: number;

  init(): Promise<void>;
  setThemePreference(preference: ThemePreference): Promise<void>;
  selectProject(id: string): Promise<void>;
  createProject(input: {
    name: string;
    color: string;
    initialRate?: number | null;
  }): Promise<void>;
  updateProject(id: string, patch: { name?: string; color?: string }): Promise<void>;

  setView(view: ViewKind): void;
  drillToMonth(monthKey: string): void;
  drillToWeek(weekKey: string): void;
  openDay(dateKey: string, anchor?: AnchorRect): void;
  closeDay(): void;
  closeQuickAdd(): void;
  openSettings(): void;
  closeSettings(): void;
  goToday(): void;
  goPrev(): void;
  goNext(): void;

  bumpData(): void;
}

/** Asks the OS directly via a native AppKit call (the `system_theme_mode`
 *  Rust command) instead of trusting the webview's own `prefers-color-scheme`
 *  or tao's cached window theme — both can get stuck at whatever they were
 *  when the webview was created and never reflect a live OS appearance
 *  change inside Tauri's packaged app. Falls back to matchMedia outside
 *  Tauri (e.g. a plain browser preview) or on non-macOS platforms. */
async function resolveSystemThemeMode(): Promise<ThemeMode> {
  try {
    const theme = await invoke<ThemeMode>("system_theme_mode");
    if (theme) return theme;
  } catch {
    // not running inside Tauri, or unsupported platform
  }
  return resolveThemeMode("system");
}

/** The db is the source of truth for the theme preference, but it isn't
 *  readable until migrations finish — too late for the first paint. Mirror the
 *  preference in localStorage so startup can honour an explicit light/dark
 *  straight away instead of opening in the OS appearance and correcting itself
 *  a moment later. */
const THEME_PREFERENCE_HINT = "themePreference";

function readThemePreferenceHint(): ThemePreference {
  const hint = localStorage.getItem(THEME_PREFERENCE_HINT);
  return hint === "light" || hint === "dark" || hint === "system" ? hint : "system";
}

const hintedPreference = readThemePreferenceHint();

/** Repaint the app in `themeMode` (tokens + the current project's accent). */
function applyThemeMode(themeMode: ThemeMode): void {
  const { projects, currentProjectId } = useAppStore.getState();
  applyTheme(themeMode);
  const project = projects.find((p) => p.id === currentProjectId);
  if (project) applyProjectAccent(project.color, themeMode);
  useAppStore.setState({ themeMode });
}

/** Follow the OS while "system" is selected: ask AppKit once a second rather
 *  than relying on the webview's own prefers-color-scheme or tao's
 *  theme-changed event, neither of which fires dependably inside Tauri. The
 *  native read is cheap, and a repaint only happens when the answer changes.
 *
 *  The timer is owned at module scope rather than created inside `init`: it
 *  paints the shared `document`, so a second copy left running by StrictMode's
 *  double-mount — or by a hot-replaced module — would keep restyling the app
 *  from a store instance that nothing renders any more, overriding the theme
 *  the user actually picked. */
let systemThemeTimer: ReturnType<typeof setInterval> | undefined;

function watchSystemTheme(): void {
  clearInterval(systemThemeTimer);
  systemThemeTimer = setInterval(() => {
    if (useAppStore.getState().themePreference !== "system") return;
    void resolveSystemThemeMode().then((themeMode) => {
      const state = useAppStore.getState();
      if (state.themePreference === "system" && themeMode !== state.themeMode) {
        applyThemeMode(themeMode);
      }
    });
  }, 1000);
}

import.meta.hot?.dispose(() => clearInterval(systemThemeTimer));

function shiftAnchor(view: ViewKind, anchorKey: string, delta: number): string {
  switch (view) {
    case "year":
      return `${yearOf(anchorKey) + delta}-01-01`;
    case "month":
      return `${addMonthsKey(monthKeyOf(anchorKey), delta)}-01`;
    case "week":
      return addWeeksKey(weekKeyFor(anchorKey), delta);
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  status: "loading",
  error: null,
  projects: [],
  currentProjectId: null,
  view: "month",
  anchorKey: todayKey(),
  selectedDayKey: null,
  quickAdd: null,
  settingsOpen: false,
  themePreference: hintedPreference,
  themeMode: resolveThemeMode(hintedPreference),
  dataVersion: 0,

  async init() {
    // paint from the localStorage hint immediately so there's no flash of the
    // wrong mode while the authoritative preference loads from the db
    applyTheme(get().themeMode);

    watchSystemTheme();

    try {
      initLocale();
      await getDb(); // triggers migrations
      const storedThemePreference = await settingsRepo.getSetting(
        settingsRepo.THEME_PREFERENCE,
      );
      const themePreference = (storedThemePreference as ThemePreference | null) ?? "system";
      const themeMode =
        themePreference === "system" ? await resolveSystemThemeMode() : themePreference;
      applyTheme(themeMode);
      // publish before the slower project queries: until this lands the poll
      // above is still guarding against the placeholder preference
      localStorage.setItem(THEME_PREFERENCE_HINT, themePreference);
      set({ themePreference, themeMode });

      const projects = await projectsRepo.listProjects();
      if (projects.length === 0) {
        set({ status: "onboarding", projects });
        return;
      }
      const lastId = await settingsRepo.getSetting(settingsRepo.LAST_SELECTED_PROJECT_ID);
      const current = projects.find((p) => p.id === lastId) ?? projects[0];
      applyProjectAccent(current.color, themeMode);
      set({
        status: "ready",
        projects,
        currentProjectId: current.id,
        view: "month",
        anchorKey: todayKey(),
      });
    } catch (e) {
      set({ status: "error", error: String(e) });
    }
  },

  async setThemePreference(preference) {
    set({ themePreference: preference });
    localStorage.setItem(THEME_PREFERENCE_HINT, preference);
    applyThemeMode(preference === "system" ? await resolveSystemThemeMode() : preference);
    await settingsRepo.setSetting(settingsRepo.THEME_PREFERENCE, preference);
  },

  async selectProject(id) {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return;
    applyProjectAccent(project.color, get().themeMode);
    set({ currentProjectId: id, selectedDayKey: null, quickAdd: null, settingsOpen: false });
    await settingsRepo.setSetting(settingsRepo.LAST_SELECTED_PROJECT_ID, id);
  },

  async createProject(input) {
    const project = await projectsRepo.createProject(input);
    const projects = await projectsRepo.listProjects();
    applyProjectAccent(project.color, get().themeMode);
    set((s) => ({
      projects,
      currentProjectId: project.id,
      status: "ready",
      view: "month",
      anchorKey: todayKey(),
      dataVersion: s.dataVersion + 1,
    }));
    await settingsRepo.setSetting(settingsRepo.LAST_SELECTED_PROJECT_ID, project.id);
  },

  async updateProject(id, patch) {
    await projectsRepo.updateProject(id, patch);
    const projects = await projectsRepo.listProjects();
    const current = projects.find((p) => p.id === get().currentProjectId);
    if (current) applyProjectAccent(current.color, get().themeMode);
    set((s) => ({ projects, dataVersion: s.dataVersion + 1 }));
  },

  setView(view) {
    set({ view, quickAdd: null });
  },
  drillToMonth(monthKey) {
    set({ view: "month", anchorKey: `${monthKey}-01`, quickAdd: null });
  },
  drillToWeek(weekKey) {
    set({ view: "week", anchorKey: weekKey, quickAdd: null });
  },
  openDay(dateKey, anchor) {
    // tapping today's cell almost always means "log an entry now" — arm the
    // quick-add bubble alongside the panel; other days just open the panel
    const isToday = dateKey === todayKey();
    set({
      selectedDayKey: dateKey,
      quickAdd: isToday && anchor ? { dateKey, anchor } : null,
    });
  },
  closeDay() {
    set({ selectedDayKey: null, quickAdd: null });
  },
  closeQuickAdd() {
    set({ quickAdd: null });
  },
  openSettings() {
    set({ settingsOpen: true });
  },
  closeSettings() {
    set({ settingsOpen: false });
  },
  goToday() {
    // jump to the current period and open (or switch) the day panel to today
    set({ anchorKey: todayKey(), selectedDayKey: todayKey(), quickAdd: null });
  },
  goPrev() {
    set((s) => ({ anchorKey: shiftAnchor(s.view, s.anchorKey, -1), quickAdd: null }));
  },
  goNext() {
    set((s) => ({ anchorKey: shiftAnchor(s.view, s.anchorKey, 1), quickAdd: null }));
  },

  bumpData() {
    set((s) => ({ dataVersion: s.dataVersion + 1 }));
  },
}));
