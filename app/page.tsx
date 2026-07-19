import { KeyRound, LockKeyhole, ScanSearch, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { PageShell } from "@/components/Shell";

const STANDARDS = ["OWASP ASVS 5.0", "OWASP Top 10", "NIST SP 800-63B", "HIBP k-anonymity", "zxcvbn-ts", "Argon2id"];

const FEATURES = [
  { icon: ScanSearch, title: "Live strength analysis", body: "zxcvbn-ts runs in your browser and on the server — the same module, so verdicts always match. Entropy, crack time, and reasons, not a naive meter." },
  { icon: LockKeyhole, title: "Breach detection", body: "Have I Been Pwned via k-anonymity: only a 5-char SHA-1 prefix is ever sent. Plaintext, full hash, and suffix are never logged." },
  { icon: ShieldCheck, title: "NIST 800-63B policy", body: "Length and uniqueness over forced composition. No periodic rotation. Block breached and common passwords. Configurable by admins." },
  { icon: KeyRound, title: "Hardened by design", body: "Argon2id storage, WebAuthn passkeys + TOTP MFA, per-route rate limits, CSRF, strict CSP with a nonce, and audited admin actions." },
];

export default function LandingPage() {
  return (
    <PageShell>
      <header style={{ padding: "48px 0 8px" }}>
        <div className="eyebrow">Password security platform · “Entropy &amp; Vault”</div>
        <h1 className="mast">
          A security instrument
          <br />
          for passwords.
        </h1>
        <p className="lead">
          KeyShield checks password strength, detects breached credentials, and enforces modern
          authentication policy — while the app itself is built to resist the very attacks it defends against.
        </p>
        <div className="btns" style={{ marginTop: 26 }}>
          <Link href="/checker" className="btn btn-primary">
            Open the checker
          </Link>
          <Link href="/security" className="btn btn-secondary">
            Security &amp; privacy model
          </Link>
          <Link href="/docs/api" className="btn btn-ghost">
            API docs
          </Link>
        </div>
        <div className="mast-badges" style={{ marginTop: 26 }}>
          {STANDARDS.map((s) => (
            <span key={s} className="std">
              <b>{s.split(" ")[0]}</b> {s.split(" ").slice(1).join(" ")}
            </span>
          ))}
        </div>
      </header>

      <section className="block" style={{ marginTop: 24 }}>
        <div className="sec-head">
          <div>
            <span className="idx">01 — Capabilities</span>
            <h2 className="sec">What KeyShield does</h2>
          </div>
        </div>
        <div className="grid g2">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="card tall">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span className="mark" style={{ width: 34, height: 34, borderRadius: 9 }}>
                    <Icon size={18} />
                  </span>
                  <h3 style={{ fontFamily: "var(--mono)", fontSize: 17, margin: 0 }}>{f.title}</h3>
                </div>
                <p style={{ color: "var(--text-mut)", fontSize: 14, margin: 0 }}>{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="block">
        <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 className="sec" style={{ fontSize: 20 }}>Try it now — nothing is sent anywhere</h2>
            <p style={{ color: "var(--text-mut)", fontSize: 14, margin: "6px 0 0" }}>
              Strength is computed locally. Breach checks send only a hash prefix.
            </p>
          </div>
          <Link href="/checker" className="btn btn-primary">
            Check a password
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
