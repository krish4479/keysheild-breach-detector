import type { NeuralScore } from "@/lib/strength/neural";

const RANK: Record<string, number> = { Weak: 0, Fair: 1, Good: 2, Strong: 3 };
const RAMP: Record<string, string> = {
  Weak: "var(--weak)",
  Fair: "var(--fair)",
  Good: "var(--good)",
  Strong: "var(--strong)",
};

/** Compare the neural verdict to the rule-based (zxcvbn) label — a nice talking point. */
function comparison(neural: string, zxcvbn: string): string {
  const a = RANK[neural] ?? 0;
  const b = RANK[zxcvbn] ?? 0;
  if (a === b) return "Agrees with the rule-based engine.";
  if (a < b) return "More cautious than the rule-based engine.";
  return "Rates this stronger than the rule-based engine.";
}

function formatTrainedOn(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

/**
 * "AI Guessability" gauge — renders the neural model's verdict next to the
 * classical strength meter. Renders nothing when the model is unavailable or
 * there's no password yet, so the checker is never affected by its absence.
 */
export function NeuralGauge({
  neural,
  zxcvbnLabel,
  hasValue,
}: {
  neural: NeuralScore | null;
  zxcvbnLabel: string;
  hasValue: boolean;
}) {
  if (!hasValue || !neural) return null;
  const color = RAMP[neural.label] ?? "var(--iris)";

  return (
    <div
      style={{
        marginTop: 14,
        padding: "13px 15px",
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "var(--surface-2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span
          className="mono"
          style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-faint)" }}
        >
          AI Guessability
          <span
            style={{
              marginLeft: 8,
              padding: "1px 6px",
              borderRadius: 999,
              border: "1px solid var(--border-2)",
              color: "var(--iris)",
              fontSize: 9.5,
              letterSpacing: "0.08em",
            }}
          >
            NEURAL
          </span>
        </span>
        <span className="mono tnum" style={{ fontSize: 12, fontWeight: 700, color }}>
          {neural.label} · {neural.score}/100
        </span>
      </div>

      <div
        style={{ marginTop: 10, height: 7, borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border)", overflow: "hidden" }}
        role="meter"
        aria-valuenow={neural.score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`AI guessability score ${neural.score} of 100`}
      >
        <div style={{ width: `${neural.score}%`, height: "100%", background: color, transition: "width var(--dur-3, 300ms) var(--ease-out, ease), background var(--dur-3, 300ms) var(--ease-out, ease)" }} />
      </div>

      <div style={{ marginTop: 9, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--text-mut)" }}>{comparison(neural.label, zxcvbnLabel)}</span>
        <span className="mono tnum" style={{ fontSize: 11, color: "var(--text-faint)" }}>
          est. ~10<sup>{neural.guessesLog10}</sup> guesses
        </span>
      </div>

      {neural.trainedOn > 0 ? (
        <div className="mono" style={{ marginTop: 8, fontSize: 10, color: "var(--text-faint)", letterSpacing: "0.03em" }}>
          Neural model · trained on {formatTrainedOn(neural.trainedOn)} breached passwords · HIBP-weighted · runs on your device
        </div>
      ) : null}
    </div>
  );
}
