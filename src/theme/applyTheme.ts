import { projectColorByName, projectColors, semanticTokens } from "./tokens";

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

export type ThemeMode = "light" | "dark";
export type ThemePreference = "system" | ThemeMode;

/** Resolve every token to a CSS custom property on :root. */
export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  root.style.colorScheme = mode;
  for (const [name, pair] of Object.entries(semanticTokens)) {
    root.style.setProperty(`--color-${kebab(name)}`, pair[mode]);
  }
  for (const color of projectColors) {
    root.style.setProperty(`--project-${color.name}`, color.accent[mode]);
    root.style.setProperty(`--project-${color.name}-soft`, color.soft[mode]);
  }
}

export function systemThemeMode(): ThemeMode {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveThemeMode(preference: ThemePreference): ThemeMode {
  return preference === "system" ? systemThemeMode() : preference;
}

/** Hue the app to the current project's color. */
export function applyProjectAccent(colorName: string, mode: ThemeMode = "light"): void {
  const color = projectColorByName(colorName);
  const root = document.documentElement;
  root.style.setProperty("--project-accent", color.accent[mode]);
  root.style.setProperty("--project-accent-soft", color.soft[mode]);
}
