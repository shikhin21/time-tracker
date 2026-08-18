import { useEffect, useMemo, useState } from "react";
import { getDistinctTasks } from "../../db/entriesRepo";
import { fuzzyFilter } from "../../lib/fuzzy";

/** Task field with fuzzy type-ahead over the project's previous tasks.
 *  Enter with a highlighted suggestion picks it; otherwise Enter falls through
 *  to the form (save). Escape closes the dropdown first, then the editor. */
export function TaskInput(props: {
  projectId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [allTasks, setAllTasks] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    let cancelled = false;
    getDistinctTasks(props.projectId).then((tasks) => {
      if (!cancelled) setAllTasks(tasks);
    });
    return () => {
      cancelled = true;
    };
  }, [props.projectId]);

  const matches = useMemo(() => fuzzyFilter(props.value, allTasks), [props.value, allTasks]);
  const visible =
    open && matches.length > 0 && !(matches.length === 1 && matches[0] === props.value);

  const pick = (task: string) => {
    props.onChange(task);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div className="task-combobox">
      <input
        className="entry-task-input"
        aria-label="Task"
        placeholder="Task (optional)"
        value={props.value}
        onChange={(e) => {
          props.onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (!visible && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            setOpen(true);
            return;
          }
          if (!visible) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % matches.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? matches.length - 1 : a - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault(); // pick, don't submit the form
            pick(matches[active]);
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation(); // dropdown consumes it; editor stays open
            setOpen(false);
            setActive(-1);
          }
        }}
      />
      {visible && (
        <ul className="task-suggestions" role="listbox">
          {matches.map((task, i) => (
            <li
              key={task}
              role="option"
              aria-selected={i === active}
              className={`task-suggestion${i === active ? " active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // keep input focus so blur doesn't race the pick
                pick(task);
              }}
            >
              {task}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
