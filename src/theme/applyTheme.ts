import { projectColorByName, projectColors, semanticTokens } from "./tokens";

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

export type ThemeMode = "light" | "dark";

/** Resolve every token to a CSS custom property on :root. v1 calls this once
 *  with "light"; theme switching later is just calling it with "dark". */
export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  for (const [name, pair] of Object.entries(semanticTokens)) {
    root.style.setProperty(`--color-${kebab(name)}`, pair[mode]);
  }
  for (const color of projectColors) {
    root.style.setProperty(`--project-${color.name}`, color.accent[mode]);
    root.style.setProperty(`--project-${color.name}-soft`, color.soft[mode]);
  }
}

/** Hue the app to the current project's color. */
export function applyProjectAccent(colorName: string, mode: ThemeMode = "light"): void {
  const color = projectColorByName(colorName);
  const root = document.documentElement;
  root.style.setProperty("--project-accent", color.accent[mode]);
  root.style.setProperty("--project-accent-soft", color.soft[mode]);
}
