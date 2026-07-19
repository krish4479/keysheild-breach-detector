import { SignupDemo } from "@/components/SignupDemo";
import { PageShell } from "@/components/Shell";
import { getActivePolicy } from "@/lib/policy/store";

export default async function SignupDemoPage() {
  const policy = await getActivePolicy();
  return (
    <PageShell>
      <section style={{ padding: "28px 0", maxWidth: 660, margin: "0 auto" }}>
        <div className="eyebrow">Secure signup · demo</div>
        <h1 className="mast" style={{ fontSize: "clamp(26px, 4vw, 38px)" }}>
          Signup with live strength &amp; breach checks
        </h1>
        <p className="lead">
          A demonstration of the signup flow: strength is analyzed locally, the account is only accepted
          if the password passes the server-enforced policy, and breached passwords are blocked.
        </p>
        <div style={{ marginTop: 24 }}>
          <SignupDemo policy={policy} />
        </div>
      </section>
    </PageShell>
  );
}
