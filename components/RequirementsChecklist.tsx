export interface Requirement {
  key: string;
  label: string;
  met: boolean;
}

export function RequirementsChecklist({ items }: { items: Requirement[] }) {
  return (
    <ul className="checklist">
      {items.map((item) => (
        <li key={item.key} className={item.met ? "met" : ""}>
          <span className={`ic ${item.met ? "ok" : "no"}`} aria-hidden="true">
            {item.met ? "✓" : "–"}
          </span>
          <span>
            {item.label}
            <span className="sr-only">{item.met ? " (met)" : " (not met)"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
