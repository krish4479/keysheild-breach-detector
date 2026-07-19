"use client";

import { useState } from "react";
import { PasswordAnalyzer } from "@/components/PasswordAnalyzer";
import { PasswordField } from "@/components/PasswordField";
import type { PolicySettings } from "@/lib/policy";

export function ChangePasswordDemo({ policy }: { policy: PolicySettings }) {
  const [current, setCurrent] = useState("");
  const [valid, setValid] = useState(false);
  const [changed, setChanged] = useState(false);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="card">
        <div className="spec-label">Current password · demo — never verified or stored here</div>
        <PasswordField value={current} onValueChange={setCurrent} placeholder="Your current password" aria-label="Current password" />
        <p style={{ fontSize: 12.5, color: "var(--text-faint)", margin: "12px 0 0" }}>
          On a real change, the new password is also checked against your recent passwords to prevent reuse.
        </p>
      </div>

      <PasswordAnalyzer
        policy={policy}
        placeholder="Choose a new passphrase"
        onVerdict={(v) => {
          setValid(Boolean(v?.valid));
          setChanged(false);
        }}
      />

      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13.5, color: "var(--text-mut)" }}>NIST discourages forced rotation — change only when compromise is suspected.</span>
        <button type="button" className="btn btn-primary" disabled={!valid || !current} onClick={() => setChanged(true)}>
          Update password
        </button>
      </div>
      {changed ? <div className="alert ok">Password would be updated — it satisfies policy and is not a recent reuse.</div> : null}
    </div>
  );
}
