// Single source of truth for all color. Light AND dark values are defined for
// every token; v1 wires up only the light set (applyTheme). Components use
// CSS custom properties exclusively — no raw hex outside this file.

export interface TokenPair {
  light: string;
  dark: string;
}

export const semanticTokens = {
  background: { light: "#F7F7F5", dark: "#1D1D1B" },
  surface: { light: "#FFFFFF", dark: "#262624" },
  surfaceSunken: { light: "#EFEFEC", dark: "#212120" },
  /** Subtle wash behind Saturday/Sunday cells — off days. */
  weekendTint: { light: "#F1F0E9", dark: "#232320" },
  border: { light: "#E1E1DC", dark: "#3A3A36" },
  borderStrong: { light: "#C9C9C2", dark: "#4E4E48" },
  textPrimary: { light: "#1B1B19", dark: "#EDEDEA" },
  textSecondary: { light: "#5E5E58", dark: "#AFAFA8" },
  textMuted: { light: "#98988F", dark: "#7C7C74" },
  danger: { light: "#BC3F3F", dark: "#E06C6C" },
  dangerSoft: { light: "#F8E7E7", dark: "#42302F" },
  overlay: { light: "rgba(27, 27, 25, 0.35)", dark: "rgba(0, 0, 0, 0.55)" },
} satisfies Record<string, TokenPair>;

export type SemanticToken = keyof typeof semanticTokens;

export interface ProjectColor {
  name: string;
  /** Accent: text/borders/emphasis on the theme background. */
  accent: TokenPair;
  /** Soft: cell/badge background tint behind primary text. */
  soft: TokenPair;
}

export const projectColors: ProjectColor[] = [
  { name: "red", accent: { light: "#C0504A", dark: "#DE8078" }, soft: { light: "#F6E5E3", dark: "#463130" } },
  { name: "orange", accent: { light: "#C07430", dark: "#DB9A5E" }, soft: { light: "#F7EADC", dark: "#46382A" } },
  { name: "amber", accent: { light: "#A98A2A", dark: "#CCB055" }, soft: { light: "#F4EDD5", dark: "#443E29" } },
  { name: "green", accent: { light: "#4C8850", dark: "#7BAF7E" }, soft: { light: "#E3EFE4", dark: "#2E3F2F" } },
  { name: "teal", accent: { light: "#3B8B84", dark: "#66AFA8" }, soft: { light: "#DFEEEC", dark: "#293F3D" } },
  { name: "blue", accent: { light: "#4671B4", dark: "#7A9BD1" }, soft: { light: "#E2E9F5", dark: "#2C364B" } },
  { name: "violet", accent: { light: "#7659AE", dark: "#9E82CC" }, soft: { light: "#EAE4F5", dark: "#372E4B" } },
  { name: "pink", accent: { light: "#B04F87", dark: "#D07FAC" }, soft: { light: "#F5E3ED", dark: "#452C3A" } },
];

export const DEFAULT_PROJECT_COLOR = "blue";

export function projectColorByName(name: string): ProjectColor {
  return projectColors.find((c) => c.name === name) ?? projectColors[5]; // blue fallback
}
