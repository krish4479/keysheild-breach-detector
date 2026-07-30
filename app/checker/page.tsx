import { PasswordAnalyzer } from "@/components/PasswordAnalyzer";
import { PrivacyNote } from "@/components/PrivacyNote";
import { PageShell } from "@/components/Shell";
import { getActivePolicy } from "@/lib/policy/store";

export default async function CheckerPage() {
  const policy = await getActivePolicy();
  return (
    <PageShell>
      <section style={{ padding: "28px 0", maxWidth: 660, margin: "0 auto" }}>
        <div className="eyebrow">Password checker</div>
        <h1 className="mast" style={{ fontSize: "clamp(28px, 4vw, 42px)" }}>
          Is your password strong &amp; safe?
        </h1>
        <p className="lead">
          Enter a username and password — strength is analyzed on your device as you type, and the checker
          makes sure your password doesn&apos;t reuse your username. Breach detection sends only a 5-character
          hash prefix — never your password.
        </p>
        <div style={{ margin: "22px 0 18px" }}>
          <PrivacyNote />
        </div>
        <PasswordAnalyzer policy={policy} showUsername />
      </section>
    </PageShell>
  );
}
