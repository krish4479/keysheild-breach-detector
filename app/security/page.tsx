import { PageShell } from "@/components/Shell";

const SECTIONS = [
  {
    idx: "01",
    title: "How breach detection stays private",
    points: [
      "Your password is hashed with SHA-1 locally on the server; only the first 5 hex characters of that hash are sent to the Have I Been Pwned range API.",
      "The Add-Padding header is set so response sizes don't leak which prefix was queried. All traffic is HTTPS-only.",
      "The returned suffixes are compared locally to find any match and its breach count. The plaintext, the full hash, and the suffix are never logged, stored, or cached.",
      "Only the safe 5-character prefix responses are cached, briefly, in Redis.",
    ],
  },
  {
    idx: "02",
    title: "Hashing: two different jobs",
    points: [
      "SHA-1 is used only for the k-anonymity breach lookup — never for storage.",
      "Admin passwords are stored with Argon2id (memory-hard, unique per-hash salt, OWASP parameters).",
      "The app never stores a user's checked password. Every function that touches a password uses it and lets it fall out of scope.",
    ],
  },
  {
    idx: "03",
    title: "Authentication & sessions",
    points: [
      "WebAuthn passkeys are preferred; TOTP provides seedable MFA. MFA is required for admin accounts.",
      "Sessions live in the database with an encrypted, httpOnly, Secure, SameSite cookie carrying only the session id — never a token in localStorage.",
      "Sessions rotate on login and on privilege change, enforce idle and absolute timeouts, and can be revoked individually or all at once.",
      "Login and reset errors are generic to prevent account enumeration; repeated failures trigger a temporary lockout.",
    ],
  },
  {
    idx: "04",
    title: "The app defends itself",
    points: [
      "Strict Content-Security-Policy with a per-request nonce (no unsafe-inline scripts), HSTS, nosniff, frame-ancestors 'none', and a locked-down Permissions-Policy.",
      "Every request body, query, and header is validated with Zod (unknown fields rejected). All database access is parameterized via Drizzle.",
      "CSRF is blocked by an Origin allowlist plus a double-submit token on every cookie-authenticated mutation.",
      "Rate limits apply separately per IP, account, session, and route, backed by Redis.",
    ],
  },
  {
    idx: "05",
    title: "Privacy & data retention",
    points: [
      "Only aggregate password-check metadata is stored (counts of checks, weak/breached blocks, rejection reasons) — never a password or a per-check identifier.",
      "Admin actions are audited without any secret data.",
      "Structured logs redact passwords, hashes, suffixes, tokens, and secrets automatically.",
    ],
  },
];

export default function SecurityPage() {
  return (
    <PageShell>
      <header style={{ padding: "40px 0 8px" }}>
        <div className="eyebrow">Security &amp; privacy model</div>
        <h1 className="mast" style={{ fontSize: "clamp(28px, 5vw, 48px)" }}>
          What we protect, and how.
        </h1>
        <p className="lead">
          KeyShield is a security product, so its own posture matters as much as its verdicts. This is the
          plain-language version of the threat model, privacy model, and hardening baseline.
        </p>
      </header>

      {SECTIONS.map((s) => (
        <section key={s.idx} className="block">
          <div className="sec-head">
            <div>
              <span className="idx">
                {s.idx} — Model
              </span>
              <h2 className="sec">{s.title}</h2>
            </div>
          </div>
          <div className="card">
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 10, color: "var(--text-mut)", fontSize: 14.5 }}>
              {s.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </section>
      ))}
    </PageShell>
  );
}
