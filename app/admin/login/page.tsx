"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PasswordField } from "@/components/PasswordField";
import { apiMutate } from "@/lib/client-api";

interface LoginResponse {
  mfaRequired?: boolean;
  message?: string;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"login" | "mfa">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, data } = await apiMutate<LoginResponse>("/api/auth/login", "POST", { email, password });
    setBusy(false);
    if (!ok) {
      setError(data.message ?? "Invalid email or password.");
      return;
    }
    if (data.mfaRequired) setStep("mfa");
    else {
      router.push("/admin/dashboard");
      router.refresh();
    }
  }

  async function submitMfa(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, data } = await apiMutate<LoginResponse>("/api/auth/mfa", "POST", { code });
    setBusy(false);
    if (!ok) {
      setError(data.message ?? "Invalid code.");
      return;
    }
    router.push("/admin/dashboard");
    router.refresh();
  }

  return (
    <section style={{ maxWidth: 400, margin: "48px auto" }}>
      <div className="card tall">
        <div className="eyebrow">Admin sign-in</div>
        <h1 style={{ fontFamily: "var(--mono)", fontSize: 22, margin: "8px 0 4px" }}>
          {step === "login" ? "Authenticate" : "Enter your code"}
        </h1>
        <p style={{ color: "var(--text-mut)", fontSize: 13.5, margin: "0 0 18px" }}>
          {step === "login"
            ? "Admin accounts require multi-factor authentication."
            : "Open your authenticator app and enter the 6-digit TOTP code."}
        </p>

        {error ? (
          <div className="alert err" role="alert">
            {error}
          </div>
        ) : null}

        {step === "login" ? (
          <form onSubmit={submitLogin}>
            <div className="formfield">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="formfield">
              <label htmlFor="password">Password</label>
              <PasswordField value={password} onValueChange={setPassword} placeholder="Your password" aria-label="Password" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
              {busy ? "Signing in…" : "Continue"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitMfa}>
            <div className="formfield">
              <label htmlFor="code">6-digit code</label>
              <input
                id="code"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy || code.length !== 6} style={{ width: "100%", justifyContent: "center" }}>
              {busy ? "Verifying…" : "Verify"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
