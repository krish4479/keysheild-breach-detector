"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatCard } from "@/components/StatCard";
import { formatCount } from "@/lib/utils";

interface Metrics {
  totals: { passwordChecks: number; weakBlocked: number; breachedBlocked: number; rateLimitEvents: number; suspiciousEvents: number };
  topReasons: { reason: string; count: number }[];
  series: { day: string; passwordChecks: number; weakBlocked: number; breachedBlocked: number }[];
  mfaAdoption: number;
  passkeyAdoption: number;
  breach: { mode: string; apiHealthy: boolean };
  scanStatus: { managedBy: string; scanners: string[]; status: string };
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export function DashboardClient() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/admin/metrics", { credentials: "same-origin" })
      .then((r) => {
        // Session expired between server render and this fetch → re-authenticate.
        if (r.status === 401 || r.status === 403) {
          window.location.href = "/admin/login";
          return null;
        }
        return r.ok ? r.json() : Promise.reject(new Error(String(r.status)));
      })
      .then((d: Metrics | null) => {
        if (d) setMetrics(d);
      })
      .catch(() => setError(true));
  }, []);

  if (error) return <div className="alert err" style={{ marginTop: 24 }}>Could not load metrics.</div>;
  if (!metrics) return <p className="mono" style={{ color: "var(--text-faint)", marginTop: 24 }}>Loading analytics…</p>;

  const t = metrics.totals;
  const checksSeries = metrics.series.map((s) => s.passwordChecks);

  return (
    <section style={{ padding: "20px 0" }}>
      <div className="sec-head">
        <div>
          <span className="idx">Analytics</span>
          <h2 className="sec">Security dashboard</h2>
          <p>Aggregate metadata only — never a password, hash, or per-check identifier.</p>
        </div>
      </div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <StatCard label="Password checks" value={compact.format(t.passwordChecks)} series={checksSeries} color="#7B6CF6" />
        <StatCard label="Weak blocked" value={formatCount(t.weakBlocked)} color="#F5A623" series={metrics.series.map((s) => s.weakBlocked)} />
        <StatCard label="Breached blocked" value={formatCount(t.breachedBlocked)} color="#F0555F" series={metrics.series.map((s) => s.breachedBlocked)} />
        <StatCard label="MFA adoption" value={`${metrics.mfaAdoption}%`} delta={`passkeys ${metrics.passkeyAdoption}%`} color="#22C68A" />
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="spec-label">Top rejection reasons</div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={metrics.topReasons}>
              <CartesianGrid strokeDasharray="3 3" stroke="#8890b0" strokeOpacity={0.2} />
              <XAxis dataKey="reason" tick={{ fill: "#737d9b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#737d9b", fontSize: 11 }} width={34} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill="#7B6CF6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="spec-label">Password checks · daily</div>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={metrics.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#8890b0" strokeOpacity={0.2} />
              <XAxis dataKey="day" tick={{ fill: "#737d9b", fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={{ fill: "#737d9b", fontSize: 11 }} width={40} tickFormatter={(v: number) => compact.format(v)} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="passwordChecks" stroke="#34C7E4" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="breachedBlocked" stroke="#F0555F" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid g3" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="spec-label">Breach service</div>
          <p style={{ fontSize: 14, margin: 0 }}>
            Mode: <b className="mono">{metrics.breach.mode}</b>
          </p>
          <p style={{ fontSize: 14, margin: "6px 0 0", color: metrics.breach.apiHealthy ? "var(--strong)" : "var(--fair)" }}>
            {metrics.breach.apiHealthy ? "● Reachable" : "● Degraded"}
          </p>
        </div>
        <div className="card">
          <div className="spec-label">Abuse events</div>
          <p style={{ fontSize: 14, margin: 0 }}>
            Rate-limit trips: <b className="tnum">{formatCount(t.rateLimitEvents)}</b>
          </p>
          <p style={{ fontSize: 14, margin: "6px 0 0" }}>
            Suspicious: <b className="tnum">{formatCount(t.suspiciousEvents)}</b>
          </p>
        </div>
        <div className="card">
          <div className="spec-label">Security scans · {metrics.scanStatus.status}</div>
          <p style={{ fontSize: 12.5, color: "var(--text-mut)", margin: 0 }}>{metrics.scanStatus.managedBy}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {metrics.scanStatus.scanners.map((s) => (
              <span key={s} className="tag-pill info">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
