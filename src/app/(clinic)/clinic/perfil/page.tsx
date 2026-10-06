import { PageHeader } from "@/components/clinic/page-header";
import { SettingsSectionNav } from "@/components/clinic/settings-section-nav";
import { ChangePasswordForm } from "@/components/account/change-password-form";

export const metadata = { title: "Minha conta" };

export default function ClinicPerfilPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        <PageHeader title="Configurações" subtitle="Minha conta · troca de senha" />
        <SettingsSectionNav active="perfil" />
        <ChangePasswordForm />
      </div>
    </div>
  );
}
