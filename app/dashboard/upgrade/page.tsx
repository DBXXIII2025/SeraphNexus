import DashboardNav from "../components/DashboardNav";
import {
  AdminPageContainer,
  DashboardPrimaryPanel,
} from "@/components/admin/AdminLayoutSystem";
import { SectionHeader } from "@/components/ui/app-ui";

export default function UpgradePage() {
  return (
    <AdminPageContainer className="text-[var(--text-main)]">
      <DashboardPrimaryPanel>
        <SectionHeader
          eyebrow="Legacy Workspace"
          title="Upgrade"
          description="Plan and workspace navigation for legacy dashboard routes."
        />
      </DashboardPrimaryPanel>
      <DashboardNav />
    </AdminPageContainer>
  );
}
