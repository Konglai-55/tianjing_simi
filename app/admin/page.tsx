import { AdminDashboard } from "@/components/admin-dashboard";
import { isAdmin } from "@/lib/admin-auth";
import { getSiteSettings, toAdminSafeSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const storageConfigured = Boolean(
    process.env.S3_ENDPOINT &&
    process.env.S3_BUCKET &&
    process.env.S3_PUBLIC_BASE_URL &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY,
  );
  const [initialLoggedIn, initialSettings] = await Promise.all([
    isAdmin(),
    getSiteSettings(),
  ]);
  return (
    <AdminDashboard
      initialLoggedIn={initialLoggedIn}
      initialSettings={toAdminSafeSettings(initialSettings)}
      storageConfigured={storageConfigured}
    />
  );
}
