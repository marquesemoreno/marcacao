import { ChangePasswordForm } from "@/components/account/change-password-form";

export default function ClinicPerfilPage() {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mb-6">
        Minha Conta
      </h1>
      <ChangePasswordForm />
    </div>
  );
}
