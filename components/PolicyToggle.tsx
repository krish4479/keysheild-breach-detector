export function PolicyToggle({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="row">
      <div className="meta">
        <div className="t">{label}</div>
        <div className="d">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`toggle${checked ? " on" : ""}`}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}
