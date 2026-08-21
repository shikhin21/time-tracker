import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../../store/appStore";
import type { ThemePreference } from "../../theme/applyTheme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** Solid glyphs, to match the header's gear. */
function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <rect
          key={deg}
          x="11"
          y="1.5"
          width="2"
          height="3.5"
          rx="1"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

/** App-level (not per-project) light/dark/system toggle, far right of the header. */
export function ThemeToggle() {
  const themeMode = useAppStore((s) => s.themeMode);
  const themePreference = useAppStore((s) => s.themePreference);
  const setThemePreference = useAppStore((s) => s.setThemePreference);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  return (
    <div className="theme-toggle" ref={ref}>
      <button
        className="icon-btn theme-btn"
        aria-label="Theme"
        title="Theme"
        onClick={() => setOpen((v) => !v)}
      >
        {themeMode === "dark" ? <MoonIcon /> : <SunIcon />}
      </button>
      {open && (
        <div className="theme-menu" role="menu">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`nav-btn${themePreference === opt.value ? " active" : ""}`}
              role="menuitemradio"
              aria-checked={themePreference === opt.value}
              onClick={() => {
                void setThemePreference(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
