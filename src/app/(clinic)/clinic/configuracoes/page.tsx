import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClinicRole } from "@/lib/session";
import { can } from "@/lib/clinic-permissions";
import { PageHeader } from "@/components/clinic/page-header";
import { SETTINGS_SECTIONS } from "@/components/clinic/settings-sections";

export const metadata = { title: "Configurações" };
export const dynamic = "force-dynamic";

/** Hub de Configurações: um cartão por tela (WhatsApp, Retorno, Ficha prévia, TV, Acessos,
 * Processos…). Cada cartão só aparece para quem tem a permissão da tela. */
export default async function ClinicSettingsHubPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user.id ? await getClinicRole(session.user.id) : "RECEPCAO";
  const sections = SETTINGS_SECTIONS.filter((s) => !s.perm || can(role, s.perm));

  return (
    <div className="soft-canvas h-full overflow-y-auto">
      <div className="space-y-6 p-4 sm:p-6 md:p-8 max-w-5xl mx-auto w-full">
        <PageHeader title="Configurações" subtitle="Ajustes da clínica, do número e das telas da equipe" />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <li key={s.href}>
                <Link
                  href={s.href}
                  prefetch={false}
                  className="group flex h-full items-start gap-3 glass-surface !rounded-3xl p-4 transition-colors hover:bg-white/90 dark:hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{s.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">{s.description}</span>
                  </span>
                  <ChevronRight className="mt-2.5 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
