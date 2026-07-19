import { Brand } from "@/components/Brand";
import { AdminNav } from "@/components/AdminNav";
import { getAuth } from "@/lib/auth/session";

// Admin surfaces are marked no-store by proxy.ts; auth is re-checked in each page.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuth();
  const isAdmin = Boolean(auth && auth.user.role === "admin" && auth.mfaVerified);

  return (
    <>
      <header className="wrap topnav">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Brand />
          <span className="tag-pill">Admin console</span>
        </div>
        <nav className="navlinks" aria-label="Admin">
          {isAdmin && auth ? <AdminNav email={auth.user.email} /> : null}
        </nav>
      </header>
      <main className="wrap" style={{ paddingBottom: 56 }}>
        {children}
      </main>
    </>
  );
}
