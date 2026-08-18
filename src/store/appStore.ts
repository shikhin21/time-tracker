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
import { applyProjectAccent, applyTheme } from "../theme/applyTheme";

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
  /** Bumped after every mutation; data hooks refetch on change. */
  dataVersion: number;

  init(): Promise<void>;
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
  dataVersion: 0,

  async init() {
    try {
      initLocale();
      applyTheme("light");
      await getDb(); // triggers migrations
      const projects = await projectsRepo.listProjects();
      if (projects.length === 0) {
        set({ status: "onboarding", projects });
        return;
      }
      const lastId = await settingsRepo.getSetting(settingsRepo.LAST_SELECTED_PROJECT_ID);
      const current = projects.find((p) => p.id === lastId) ?? projects[0];
      applyProjectAccent(current.color);
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

  async selectProject(id) {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return;
    applyProjectAccent(project.color);
    set({ currentProjectId: id, selectedDayKey: null, quickAdd: null, settingsOpen: false });
    await settingsRepo.setSetting(settingsRepo.LAST_SELECTED_PROJECT_ID, id);
  },

  async createProject(input) {
    const project = await projectsRepo.createProject(input);
    const projects = await projectsRepo.listProjects();
    applyProjectAccent(project.color);
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
    if (current) applyProjectAccent(current.color);
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
