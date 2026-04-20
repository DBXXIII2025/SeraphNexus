import { getActiveBusiness } from "@/lib/getActiveBusiness";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const business = await getActiveBusiness();

  if (!business) {
    return (
      <div className="text-[var(--text-main)]">
        <h1 className="text-2xl font-semibold mb-2">Business Settings</h1>
        <p className="text-sm text-[var(--text-soft)]">No active business found.</p>
      </div>
    );
  }

  return <SettingsClient business={business} />;
}
