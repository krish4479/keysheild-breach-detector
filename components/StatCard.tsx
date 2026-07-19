export function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const w = 120;
  const h = 34;
  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className="spark" viewBox="0 0 120 34" preserveAspectRatio="none" aria-hidden="true">
      <polyline fill="none" stroke={color} strokeWidth={2} points={coords} />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  delta,
  deltaDir = "up",
  color = "#7B6CF6",
  series,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaDir?: "up" | "down";
  color?: string;
  series?: number[];
}) {
  return (
    <div className="card stat">
      <div className="top">
        <span className="lbl">{label}</span>
        {delta ? <span className={`delta ${deltaDir}`}>{delta}</span> : null}
      </div>
      <div className="val tnum">{value}</div>
      {series ? <Sparkline points={series} color={color} /> : null}
    </div>
  );
}
