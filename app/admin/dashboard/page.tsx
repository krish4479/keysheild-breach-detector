import { DashboardClient } from "@/components/DashboardClient";
import { requireAdminPage } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdminPage();
  return <DashboardClient />;
}
