"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiMutate } from "@/lib/client-api";

export function AdminNav({ email }: { email: string }) {
  const router = useRouter();
  async function logout() {
    await apiMutate("/api/auth/logout", "POST");
    router.push("/admin/login");
    router.refresh();
  }
  return (
    <>
      <Link href="/admin/dashboard">Dashboard</Link>
      <Link href="/admin/policy">Policy</Link>
      <Link href="/admin/audit-logs">Audit</Link>
      <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>
        {email}
      </span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void logout()}>
        Log out
      </button>
    </>
  );
}
