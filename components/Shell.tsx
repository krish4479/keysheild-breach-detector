import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./Brand";

const NAV = [
  { href: "/checker", label: "Checker" },
  { href: "/demo/signup", label: "Signup" },
  { href: "/demo/change-password", label: "Change" },
  { href: "/security", label: "Security" },
  { href: "/docs/api", label: "API" },
  { href: "/admin/dashboard", label: "Admin" },
] as const;

export function SiteHeader() {
  return (
    <header className="wrap topnav">
      <Brand />
      <nav className="navlinks" aria-label="Primary">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href}>
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="ks-foot">
      <div className="wrap foot-grid">
        <div>
          <div className="h">KeyShield</div>
          <p style={{ margin: 0, maxWidth: "40ch" }}>
            A password-security instrument — local strength analysis, HIBP k-anonymity breach
            checks, and NIST 800-63B policy enforcement.
          </p>
        </div>
        <div>
          <div className="h">Standards</div>
          <ul>
            <li>OWASP ASVS 5.0</li>
            <li>OWASP Top 10</li>
            <li>NIST SP 800-63B</li>
            <li>HIBP k-anonymity</li>
          </ul>
        </div>
        <div>
          <div className="h">Product</div>
          <ul>
            <li>
              <Link href="/checker">Checker</Link>
            </li>
            <li>
              <Link href="/security">Security &amp; privacy</Link>
            </li>
            <li>
              <Link href="/docs/api">API docs</Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

/** Public-page chrome: header + centered main + footer. Admin uses its own shell. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="wrap" style={{ paddingBottom: 56 }}>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
