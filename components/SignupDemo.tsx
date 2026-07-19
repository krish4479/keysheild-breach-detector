"use client";

import { useState } from "react";
import { PasswordAnalyzer } from "@/components/PasswordAnalyzer";
import type { PolicySettings } from "@/lib/policy";

export function SignupDemo({ policy }: { policy: PolicySettings }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [valid, setValid] = useState(false);
  const [created, setCreated] = useState(false);

  const userInputs = [email, name, email.split("@")[0] ?? ""].filter(Boolean);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="card">
        <div className="spec-label">Account details · demo — nothing is stored</div>
        <div className="formfield">
          <label htmlFor="su-email">Email</label>
          <input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="off" />
        </div>
        <div className="formfield">
          <label htmlFor="su-name">Full name</label>
          <input id="su-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoComplete="off" />
        </div>
        <p style={{ fontSize: 12.5, color: "var(--text-faint)", margin: 0 }}>
          Your email, username, and name are passed to the strength engine as user-specific terms — passwords built from them score lower.
        </p>
      </div>

      <PasswordAnalyzer
        policy={policy}
        userInputs={userInputs}
        placeholder="Choose a strong passphrase"
        onVerdict={(v) => {
          setValid(Boolean(v?.valid));
          setCreated(false);
        }}
      />

      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13.5, color: "var(--text-mut)" }}>
          The account is created only if the password passes policy on the server.
        </span>
        <button type="button" className="btn btn-primary" disabled={!valid} onClick={() => setCreated(true)}>
          Create account
        </button>
      </div>
      {created ? <div className="alert ok">Account would be created — password satisfies the server-enforced policy.</div> : null}
    </div>
  );
}
