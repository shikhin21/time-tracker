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

export type ViewKind = "year" | "month" | "week" | "invoices";
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
  /** The invoice open in the drawer of the invoices view. */
  selectedInvoiceId: string | null;
  /** Quick-add bubble state: armed by a single tap on today, or a double-tap
   *  on any other day. */
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
  /** Repaint in `themeMode` without touching the saved preference — what the
   *  system-theme listener calls when the OS appearance changes. */
  setThemeMode(themeMode: ThemeMode): void;
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
  /** `withQuickAdd` overrides the today-only default, so a double-tap can arm
   *  the bubble on any day. */
  openDay(dateKey: string, anchor?: AnchorRect, withQuickAdd?: boolean): void;
  openInvoice(invoiceId: string): void;
  closeInvoice(): void;
  closeDay(): void;
  closeQuickAdd(): void;
  openSettings(): void;
  closeSettings(): void;
  goToday(): void;
  goPrev(): void;
  goNext(): void;

  bumpData(): void;
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

function shiftAnchor(view: ViewKind, anchorKey: string, delta: number): string {
  switch (view) {
    case "year":
      return `${yearOf(anchorKey) + delta}-01-01`;
    case "month":
      return `${addMonthsKey(monthKeyOf(anchorKey), delta)}-01`;
    case "week":
      return addWeeksKey(weekKeyFor(anchorKey), delta);
    case "invoices":
      return anchorKey; // no period to step through; the nav is hidden there
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
  selectedInvoiceId: null,
  quickAdd: null,
  settingsOpen: false,
  themePreference: hintedPreference,
  themeMode: resolveThemeMode(hintedPreference),
  dataVersion: 0,

  async init() {
    // paint from the localStorage hint immediately so there's no flash of the
    // wrong mode while the authoritative preference loads from the db
    applyTheme(get().themeMode);

    try {
      initLocale();
      await getDb(); // triggers migrations
      const storedThemePreference = await settingsRepo.getSetting(
        settingsRepo.THEME_PREFERENCE,
      );
      const themePreference = (storedThemePreference as ThemePreference | null) ?? "system";
      const themeMode = resolveThemeMode(themePreference);
      applyTheme(themeMode);
      // publish before the slower project queries, so useSystemTheme starts
      // listening on the real preference rather than the hint
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

  setThemeMode(themeMode) {
    applyTheme(themeMode);
    const project = get().projects.find((p) => p.id === get().currentProjectId);
    if (project) applyProjectAccent(project.color, themeMode);
    set({ themeMode });
  },

  async setThemePreference(preference) {
    set({ themePreference: preference });
    localStorage.setItem(THEME_PREFERENCE_HINT, preference);
    get().setThemeMode(resolveThemeMode(preference));
    await settingsRepo.setSetting(settingsRepo.THEME_PREFERENCE, preference);
  },

  async selectProject(id) {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return;
    applyProjectAccent(project.color, get().themeMode);
    set({
      currentProjectId: id,
      selectedDayKey: null,
      selectedInvoiceId: null,
      quickAdd: null,
      settingsOpen: false,
    });
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
    // the two views own different drawers, so leaving one closes its own
    set({
      view,
      quickAdd: null,
      selectedDayKey: view === "invoices" ? null : get().selectedDayKey,
      selectedInvoiceId: view === "invoices" ? get().selectedInvoiceId : null,
    });
  },
  drillToMonth(monthKey) {
    set({ view: "month", anchorKey: `${monthKey}-01`, quickAdd: null });
  },
  drillToWeek(weekKey) {
    set({ view: "week", anchorKey: weekKey, quickAdd: null });
  },
  openDay(dateKey, anchor, withQuickAdd) {
    // a single tap on today almost always means "log an entry now", so the
    // quick-add bubble is armed alongside the panel. Any other day needs the
    // intent spelled out — a double-tap, which passes withQuickAdd.
    const wantsQuickAdd = withQuickAdd ?? dateKey === todayKey();
    set({
      selectedDayKey: dateKey,
      quickAdd: wantsQuickAdd && anchor ? { dateKey, anchor } : null,
    });
  },
  openInvoice(invoiceId) {
    set({ selectedInvoiceId: invoiceId });
  },
  closeInvoice() {
    set({ selectedInvoiceId: null });
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
