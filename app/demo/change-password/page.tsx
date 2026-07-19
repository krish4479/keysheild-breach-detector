import { ChangePasswordDemo } from "@/components/ChangePasswordDemo";
import { PageShell } from "@/components/Shell";
import { getActivePolicy } from "@/lib/policy/store";

export default async function ChangePasswordDemoPage() {
  const policy = await getActivePolicy();
  return (
    <PageShell>
      <section style={{ padding: "28px 0", maxWidth: 660, margin: "0 auto" }}>
        <div className="eyebrow">Change password · demo</div>
        <h1 className="mast" style={{ fontSize: "clamp(26px, 4vw, 38px)" }}>
          Change a password, safely
        </h1>
        <p className="lead">
          The new password is analyzed locally, validated against policy on the server, checked for
          breaches, and (in production) compared against your recent passwords to prevent reuse.
        </p>
        <div style={{ marginTop: 24 }}>
          <ChangePasswordDemo policy={policy} />
        </div>
      </section>
    </PageShell>
  );
}
