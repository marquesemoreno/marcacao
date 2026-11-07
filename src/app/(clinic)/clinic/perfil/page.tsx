import { PageHeader } from "@/components/clinic/page-header";
import { SettingsSectionNav } from "@/components/clinic/settings-section-nav";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { SecurityPanel } from "@/components/account/security-panel";

export const metadata = { title: "Minha conta" };

export default function ClinicPerfilPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        <PageHeader title="Configurações" subtitle="Minha conta · senha e segurança" />
        <SettingsSectionNav active="perfil" />
        <div className="flex flex-wrap items-start gap-6">
          <ChangePasswordForm />
          <SecurityPanel />
        </div>
      </div>
    </div>
  );
}
