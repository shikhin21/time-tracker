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
  openDay(dateKey: string): void;
  closeDay(): void;
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
    set({ currentProjectId: id, selectedDayKey: null, settingsOpen: false });
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
    set({ view });
  },
  drillToMonth(monthKey) {
    set({ view: "month", anchorKey: `${monthKey}-01` });
  },
  drillToWeek(weekKey) {
    set({ view: "week", anchorKey: weekKey });
  },
  openDay(dateKey) {
    set({ selectedDayKey: dateKey });
  },
  closeDay() {
    set({ selectedDayKey: null });
  },
  openSettings() {
    set({ settingsOpen: true });
  },
  closeSettings() {
    set({ settingsOpen: false });
  },
  goToday() {
    set({ anchorKey: todayKey() });
  },
  goPrev() {
    set((s) => ({ anchorKey: shiftAnchor(s.view, s.anchorKey, -1) }));
  },
  goNext() {
    set((s) => ({ anchorKey: shiftAnchor(s.view, s.anchorKey, 1) }));
  },

  bumpData() {
    set((s) => ({ dataVersion: s.dataVersion + 1 }));
  },
}));
