import { useEffect } from "react";
import { useAppStore } from "../store/appStore";
import { systemThemeMode } from "./applyTheme";

/** Keeps the app on the OS appearance while the "system" preference is
 *  selected. Subscribes only for that preference, so an explicit light/dark
 *  can't be repainted out from under the user.
 *
 *  The subscription is owned by a component rather than by module state: the
 *  listener paints the shared document, and React's cleanup is what guarantees
 *  a stale copy — from StrictMode's double-mount or a hot-replaced module —
 *  can't survive to repaint from a store nothing renders any more. */
export function useSystemTheme(): void {
  const preference = useAppStore((s) => s.themePreference);
  const setThemeMode = useAppStore((s) => s.setThemeMode);

  useEffect(() => {
    if (preference !== "system") return;
    // catch up first: the OS may have changed while a fixed mode was selected
    setThemeMode(systemThemeMode());

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setThemeMode(e.matches ? "dark" : "light");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference, setThemeMode]);
}
