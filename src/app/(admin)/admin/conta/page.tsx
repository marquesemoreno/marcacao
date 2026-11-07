import { ChangePasswordForm } from "@/components/account/change-password-form";
import { SecurityPanel } from "@/components/account/security-panel";

export const metadata = { title: "Minha conta" };

/** Admin: troca de senha, verificação em duas etapas e últimas entradas. */
export default function AdminContaPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-6 p-4 sm:p-6 max-w-5xl">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Minha conta</h1>
        <div className="flex flex-wrap items-start gap-6">
          <ChangePasswordForm />
          <SecurityPanel />
        </div>
      </div>
    </div>
  );
}
