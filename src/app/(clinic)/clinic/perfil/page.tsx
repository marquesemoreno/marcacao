import { PageHeader } from "@/components/clinic/page-header";
import { SettingsSectionNav } from "@/components/clinic/settings-section-nav";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { SecurityPanel } from "@/components/account/security-panel";

export const metadata = { title: "Minha conta" };

export default async function ClinicPerfilPage({ searchParams }: { searchParams: Promise<{ "2fa"?: string }> }) {
  const twoFactorRequired = (await searchParams)["2fa"] === "obrigatorio";
  return (
    <div className="soft-canvas h-full overflow-y-auto">
      <div className="space-y-6 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
        <PageHeader title="Configurações" subtitle="Minha conta · senha e segurança" />
        <SettingsSectionNav active="perfil" />
        {twoFactorRequired && (
          <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            Sua função exige a verificação em duas etapas. Ative abaixo, em “Verificação em duas etapas”, para voltar a usar o painel.
          </p>
        )}
        <div className="flex flex-wrap items-start gap-6">
          <ChangePasswordForm />
          <SecurityPanel />
        </div>
      </div>
    </div>
  );
}
