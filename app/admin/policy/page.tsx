import { PolicyEditor } from "@/components/PolicyEditor";
import { requireAdminPage } from "@/lib/auth/guard";
import { getActivePolicy } from "@/lib/policy/store";

export const dynamic = "force-dynamic";

export default async function AdminPolicyPage() {
  await requireAdminPage();
  const policy = await getActivePolicy();
  return <PolicyEditor initial={policy} />;
}
