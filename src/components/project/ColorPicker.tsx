import { projectColors } from "../../theme/tokens";

export function ColorPicker(props: {
  value: string;
  onChange: (name: string) => void;
}) {
  return (
    <div className="color-picker" role="radiogroup" aria-label="Project color">
      {projectColors.map((c) => (
        <button
          key={c.name}
          type="button"
          role="radio"
          aria-checked={props.value === c.name}
          aria-label={c.name}
          className={`color-swatch${props.value === c.name ? " selected" : ""}`}
          style={{ background: `var(--project-${c.name})` }}
          onClick={() => props.onChange(c.name)}
        />
      ))}
    </div>
  );
}
