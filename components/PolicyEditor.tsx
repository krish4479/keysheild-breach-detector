"use client";

import { useState } from "react";
import { PolicyToggle } from "@/components/PolicyToggle";
import { apiMutate } from "@/lib/client-api";
import type { PolicySettings } from "@/lib/policy";

const NUMBER_FIELDS: { key: keyof PolicySettings; label: string; min: number; max: number }[] = [
  { key: "minLength", label: "Minimum length (no MFA)", min: 1, max: 256 },
  { key: "minLengthWithMfa", label: "Minimum length (with MFA)", min: 1, max: 256 },
  { key: "maxLength", label: "Maximum length", min: 64, max: 1024 },
  { key: "minZxcvbnScore", label: "Minimum strength score (0–4)", min: 0, max: 4 },
  { key: "reuseHistoryDepth", label: "Reuse history depth", min: 0, max: 50 },
];

const TOGGLE_FIELDS: { key: keyof PolicySettings; label: string; desc: string }[] = [
  { key: "blockBreached", label: "Block breached passwords", desc: "Reject anything found in the HIBP corpus" },
  { key: "blockCommon", label: "Block common passwords", desc: "Reject the common-password blocklist" },
  { key: "preventReuse", label: "Prevent password reuse", desc: "Reject a user's recent passwords" },
  { key: "allowSpaces", label: "Allow spaces", desc: "Permit spaces in passphrases" },
  { key: "allowUnicode", label: "Allow Unicode", desc: "Permit non-ASCII characters" },
  { key: "requireComposition", label: "Require character composition", desc: "NIST discourages this — off by default" },
  { key: "forcePeriodicRotation", label: "Force periodic rotation", desc: "NIST discourages this — off by default" },
];

export function PolicyEditor({ initial }: { initial: PolicySettings }) {
  const [policy, setPolicy] = useState<PolicySettings>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  function setField<K extends keyof PolicySettings>(key: K, value: PolicySettings[K]) {
    setPolicy((p) => ({ ...p, [key]: value }));
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    setMessage(null);
    const { ok, data } = await apiMutate<{ message?: string }>("/api/policy", "PUT", policy);
    if (ok) setStatus("saved");
    else {
      setStatus("error");
      setMessage(data.message ?? "Save failed — are you signed in as an admin?");
    }
  }

  return (
    <section style={{ padding: "20px 0", maxWidth: 720 }}>
      <div className="sec-head">
        <div>
          <span className="idx">Configuration</span>
          <h2 className="sec">Password policy</h2>
          <p>NIST SP 800-63B posture: length and uniqueness over forced composition. Stored in the database and enforced server-side.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="spec-label">Toggles</div>
        <div className="policy">
          {TOGGLE_FIELDS.map((f) => (
            <PolicyToggle
              key={f.key}
              label={f.label}
              description={f.desc}
              checked={Boolean(policy[f.key])}
              onChange={(next) => setField(f.key, next)}
            />
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="spec-label">Length &amp; strength</div>
        <div className="grid g2">
          {NUMBER_FIELDS.map((f) => (
            <div className="formfield" key={f.key}>
              <label htmlFor={f.key}>{f.label}</label>
              <input
                id={f.key}
                type="number"
                min={f.min}
                max={f.max}
                value={Number(policy[f.key])}
                onChange={(e) => setField(f.key, Number(e.target.value))}
              />
            </div>
          ))}
        </div>
      </div>

      {status === "saved" ? <div className="alert ok">Policy saved and now enforced.</div> : null}
      {status === "error" ? <div className="alert err">{message}</div> : null}

      <div className="btns">
        <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save policy"}
        </button>
      </div>
    </section>
  );
}
