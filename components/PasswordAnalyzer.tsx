"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiPost } from "@/lib/client-api";
import type { PolicySettings } from "@/lib/policy";
import { analyzeStrength, passwordContainsUserToken } from "@/lib/strength";
import { scoreNeural } from "@/lib/strength/neural";
import { BreachBadge, type BreachState } from "./BreachBadge";
import { NeuralGauge } from "./NeuralGauge";
import { PasswordField } from "./PasswordField";
import { RequirementsChecklist, type Requirement } from "./RequirementsChecklist";
import { StrengthMeter } from "./StrengthMeter";

interface BreachResponse {
  breached: boolean;
  count: number;
  status: "safe" | "breached" | "unknown";
}

interface ValidateResponse {
  valid: boolean;
  score: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  strengthLabel: string;
  breached: boolean;
  breachCount: number;
  reasons: string[];
  suggestions: string[];
}

export function PasswordAnalyzer({
  policy,
  userInputs = [],
  mfaEnabled = false,
  placeholder = "Try: correct horse battery staple",
  showValidateButton = true,
  showUsername = false,
  onVerdict,
}: {
  policy: PolicySettings;
  userInputs?: string[];
  mfaEnabled?: boolean;
  placeholder?: string;
  showValidateButton?: boolean;
  showUsername?: boolean;
  onVerdict?: (result: ValidateResponse | null) => void;
}) {
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [breachState, setBreachState] = useState<BreachState>("idle");
  const [breachCount, setBreachCount] = useState(0);
  const [verdict, setVerdict] = useState<ValidateResponse | null>(null);
  const [validating, setValidating] = useState(false);
  const latest = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fold the username into the user-context terms fed to the strength engine.
  const allInputs = useMemo(
    () => (showUsername && username.trim() ? [...userInputs, username] : userInputs),
    [showUsername, username, userInputs],
  );
  const analysis = useMemo(() => analyzeStrength(password, allInputs), [password, allInputs]);
  const usernameInPassword =
    showUsername && Boolean(username.trim()) && Boolean(password) && passwordContainsUserToken(password, [username]);
  // Neural guessability runs locally and defensively (scoreNeural never throws → null).
  const neural = useMemo(() => scoreNeural(password), [password]);
  const charCount = useMemo(() => Array.from(password).length, [password]);
  const effectiveMin = mfaEnabled ? policy.minLengthWithMfa : policy.minLength;

  const runBreachCheck = useCallback(async (value: string) => {
    if (!value) {
      setBreachState("idle");
      return;
    }
    setBreachState("checking");
    const { ok, data } = await apiPost<BreachResponse>("/api/password/check-breach", { password: value });
    if (latest.current !== value) return; // stale — user kept typing
    if (!ok) setBreachState("unknown");
    else if (data.status === "unknown") setBreachState("unknown");
    else if (data.breached) {
      setBreachState("breached");
      setBreachCount(data.count);
    } else setBreachState("safe");
  }, []);

  const onChange = (value: string) => {
    latest.current = value;
    setPassword(value);
    setVerdict(null);
    setBreachState("idle");
    if (timer.current) clearTimeout(timer.current);
    if (value) timer.current = setTimeout(() => void runBreachCheck(value), 700);
  };

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const requirements: Requirement[] = [
    { key: "len", label: `At least ${policy.minLength} characters (${policy.minLengthWithMfa} with MFA)`, met: charCount >= effectiveMin },
    { key: "phrase", label: "Reads like a passphrase, not a word", met: password.trim().split(/\s+/).filter(Boolean).length >= 3 },
    {
      key: "notcommon",
      label: "Not a common or breached password",
      met: Boolean(password) && breachState !== "breached" && !analysis.reasons.some((r) => r.toLowerCase().includes("common password")),
    },
    { key: "nowalk", label: "No keyboard walks or sequences", met: Boolean(password) && !analysis.reasons.some((r) => /keyboard walk|sequential/i.test(r)) },
    { key: "norepeat", label: "No long repeated runs", met: Boolean(password) && !analysis.reasons.some((r) => /repeated/i.test(r)) },
    ...(showUsername
      ? [
          {
            key: "nouser",
            label: "Doesn't contain your username",
            met: Boolean(password) && Boolean(username.trim()) && !usernameInPassword,
          },
        ]
      : []),
  ];

  const validate = async () => {
    setValidating(true);
    const { data } = await apiPost<ValidateResponse>("/api/password/validate", { password, userInputs: allInputs, mfaEnabled });
    setVerdict(data);
    onVerdict?.(data);
    setValidating(false);
  };

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="card tall">
        {showUsername ? (
          <div className="formfield" style={{ marginBottom: 14 }}>
            <label htmlFor="pa-username">Username</label>
            <input
              id="pa-username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setVerdict(null);
              }}
              placeholder="e.g. krishjosh"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ) : null}
        <div className="spec-label">Password · live strength · analyzed in your browser</div>
        <PasswordField
          value={password}
          onValueChange={onChange}
          onBlur={() => void runBreachCheck(password)}
          placeholder={placeholder}
          aria-label="Password to test"
        />
        <StrengthMeter label={analysis.label} entropyBits={analysis.entropyBits} charCount={charCount} hasValue={Boolean(password)} />
        {usernameInPassword ? (
          <div className="alert err" style={{ marginTop: 12, marginBottom: 0 }} role="alert">
            Your password contains your username — choose one that doesn&apos;t include <b>{username.trim()}</b> (or part of it).
          </div>
        ) : null}
        <div style={{ marginTop: 12 }}>
          <BreachBadge state={breachState} count={breachCount} />
        </div>

        <NeuralGauge neural={neural} zxcvbnLabel={analysis.label} hasValue={Boolean(password)} />

        {analysis.reasons.length > 0 && password ? (
          <ul style={{ margin: "14px 0 0", paddingLeft: 18, color: "var(--text-mut)", fontSize: 13.5, display: "grid", gap: 4 }}>
            {analysis.reasons.slice(0, 4).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : null}

        {showValidateButton ? (
          <div className="btns" style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-primary" onClick={() => void validate()} disabled={!password || validating}>
              {validating ? "Checking…" : "Check against policy"}
            </button>
            {password ? (
              <button type="button" className="btn btn-ghost" onClick={() => onChange("")}>
                Reset
              </button>
            ) : null}
          </div>
        ) : null}

        {verdict ? (
          <div className={`alert ${verdict.valid ? "ok" : "err"}`} style={{ marginTop: 16 }} role="status">
            <b>
              {verdict.valid ? "Accepted" : "Rejected"} · {verdict.strengthLabel} · risk {verdict.riskLevel}
              {verdict.breached ? ` · breached ×${verdict.breachCount.toLocaleString()}` : ""}
            </b>
            {verdict.suggestions.length > 0 ? (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {verdict.suggestions.slice(0, 3).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="spec-label">Requirements · NIST 800-63B</div>
        <RequirementsChecklist items={requirements} />
        <p style={{ fontSize: 12.5, color: "var(--text-faint)", margin: "16px 0 0" }}>
          Composition rules (upper/lower/symbol) are intentionally <b>not</b> required — length and uniqueness win.
        </p>
      </div>
    </div>
  );
}
