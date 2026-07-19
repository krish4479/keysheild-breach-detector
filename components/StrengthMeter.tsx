import type { StrengthLabel } from "@/lib/strength";

const FILL: Record<StrengthLabel, number> = { Weak: 1, Fair: 2, Good: 3, Strong: 4 };

export function StrengthMeter({
  label,
  entropyBits,
  charCount,
  hasValue,
}: {
  label: StrengthLabel;
  entropyBits: number;
  charCount: number;
  hasValue: boolean;
}) {
  const levelClass = label.toLowerCase();
  const filled = hasValue ? FILL[label] : 0;
  return (
    <>
      <div className="meter" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`seg${i < filled ? ` on-${levelClass}` : ""}`} />
        ))}
      </div>
      <div className="meter-foot">
        <span
          className={`badge-strength lv-${levelClass}`}
          role="status"
          aria-label={`Password strength: ${label}`}
        >
          {label}
        </span>
        <span className="entropy tnum">
          ~<b>{entropyBits}</b> bits · <b>{charCount}</b> chars
        </span>
      </div>
    </>
  );
}
