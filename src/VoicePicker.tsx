import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
export const PersonalVoiceNames = createContext<Record<string, string>>({});
type Choice = { id: string; label: string; group: string };
function choices(
  voices: string[],
  names: Record<string, string>,
  automatic?: string,
) {
  const items: Choice[] = automatic
    ? [{ id: "", label: automatic, group: "Default" }]
    : [];
  for (const id of voices) {
    if (id.startsWith("ref_")) {
      items.push({
        id,
        label: names[id] ?? id.split("_")[1].replaceAll("-", " "),
        group: "Personal voices",
      });
    } else {
      const label = id
        .split("_mix_")
        .map((part) => part.slice(3, 4).toUpperCase() + part.slice(4))
        .join(" + ");
      items.push({
        id,
        label,
        group:
          (id.startsWith("b") ? "UK" : "US") +
          " English · " +
          (id.includes("_mix_") ? "blends" : "stock"),
      });
    }
  }
  const groups = [
    "Default",
    "Personal voices",
    "US English · stock",
    "UK English · stock",
    "US English · blends",
    "UK English · blends",
  ];
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.label, (counts.get(i.label) ?? 0) + 1);
  for (const i of items)
    if (i.group === "Personal voices" && counts.get(i.label)! > 1)
      i.label += " · " + i.id.slice(-4);
  return items.sort(
    (a, b) =>
      groups.indexOf(a.group) - groups.indexOf(b.group) ||
      a.label.localeCompare(b.label),
  );
}
export function VoicePicker({
  label,
  voices,
  value,
  onChange,
  automatic,
}: {
  label: string;
  voices: string[];
  value: string;
  onChange: (v: string) => void;
  automatic?: string;
}) {
  const names = useContext(PersonalVoiceNames),
    id = useId(),
    input = useRef<HTMLInputElement>(null);
  const items = useMemo(
    () => choices(voices, names, automatic),
    [voices, names, automatic],
  );
  const selected = items.find((i) => i.id === value);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [index, setIndex] = useState(0),
    [above, setAbove] = useState(false);
  const tokens = query.trim().toLowerCase().split(/\s+/);
  const filtered = items.filter((i) =>
    tokens.every((t) =>
      (i.label + " " + i.id + " " + i.group).toLowerCase().includes(t),
    ),
  );
  const active = Math.min(index, filtered.length - 1);
  function show() {
    if (!open) {
      const r = input.current!.getBoundingClientRect();
      setAbove(window.innerHeight - r.bottom < 220 && r.top > 220);
      setQuery("");
      setIndex(0);
      setOpen(true);
    }
  }
  function select(item: Choice) {
    onChange(item.id);
    setOpen(false);
  }
  useEffect(() => {
    if (!open || active < 0) return;
    const option = document.getElementById(id + "-" + active),
      menu = document.getElementById(id + "-list");
    if (!option || !menu) return;
    const r = option.getBoundingClientRect(),
      m = menu.getBoundingClientRect();
    if (r.bottom > m.bottom) menu.scrollTop += r.bottom - m.bottom;
    else if (r.top < m.top) menu.scrollTop -= m.top - r.top;
  }, [active, open, id]);
  return (
    <div className="voice-picker">
      <label htmlFor={id}>{label}</label>
      <div className="picker-input">
        <input
          id={id}
          ref={input}
          role="combobox"
          aria-controls={id + "-list"}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-activedescendant={
            open && active >= 0 ? id + "-" + active : undefined
          }
          autoComplete="off"
          placeholder={open ? "Search voice names…" : "Choose a voice"}
          value={open ? query : (selected?.label ?? "")}
          onFocus={show}
          onClick={show}
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            show();
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && open) {
              e.preventDefault();
              setOpen(false);
            } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              if (!open) show();
              else
                setIndex(
                  Math.max(
                    0,
                    Math.min(
                      filtered.length - 1,
                      active + (e.key === "ArrowDown" ? 1 : -1),
                    ),
                  ),
                );
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (!open) show();
              else if (filtered[active]) select(filtered[active]);
            }
          }}
        />
      </div>
      {open && (
        <div
          className={"voice-menu" + (above ? " above" : "")}
          role="listbox"
          id={id + "-list"}
          aria-label={label}
        >
          {!filtered.length && <small>No matching voices</small>}
          {filtered.map((item, i) => (
            <div key={item.id}>
              {filtered[i - 1]?.group !== item.group && (
                <div className="voice-group" aria-hidden="true">
                  {item.group}
                </div>
              )}
              <div
                role="option"
                id={id + "-" + i}
                aria-selected={item.id === value}
                className={i === active ? "active" : ""}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(item)}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
