import { type ReactNode, useEffect } from "react";

export function Modal(props: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Sized to fit a full-width document preview rather than a form. */
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        className={`modal${props.wide ? " modal-wide" : ""}`}
        role="dialog"
        aria-label={props.title}
      >
        <h2>{props.title}</h2>
        {props.children}
      </div>
    </div>
  );
}
