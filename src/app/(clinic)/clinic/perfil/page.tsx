import { PageHeader } from "@/components/clinic/page-header";
import { ChangePasswordForm } from "@/components/account/change-password-form";

export const metadata = { title: "Minha conta" };

export default function ClinicPerfilPage() {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mb-6">
        <PageHeader title="Minha conta" subtitle="Troca de senha" />
      </div>
      <ChangePasswordForm />
    </div>
  );
}
