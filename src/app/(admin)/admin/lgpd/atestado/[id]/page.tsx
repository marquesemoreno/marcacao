import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { certificateLines } from "@/lib/lgpd-certificate";
import { certificateFieldsOf, issueCertificate } from "@/lib/lgpd-certificate-server";
import { PrintButton } from "@/components/admin/print-button";

export const metadata = { title: "Atestado de anonimização" };
export const dynamic = "force-dynamic";

/** Atestado de uma exclusão LGPD, pronto para imprimir ou salvar em PDF. Exclusões antigas
 * (antes do atestado) ganham o código na primeira vez que a página abre. */
export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;
  const record = await prisma.dataDeletionRecord.findUnique({ where: { id } });
  if (!record) notFound();
  const code = record.certificateCode ?? (await issueCertificate(record.id));
  const lines = certificateLines(await certificateFieldsOf(record), code ?? "não emitido (configure LGPD_CERTIFICATE_SECRET)",
    `${(process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "")}/verificar-atestado`,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/admin/lgpd" className="text-sm font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400">
          Voltar
        </Link>
        <PrintButton />
      </div>
      <article className="rounded-xl border border-slate-200 bg-white p-8 text-sm leading-relaxed text-slate-900 print:border-0 print:p-0">
        <h1 className="text-lg font-bold">{lines[0]}</h1>
        {lines.slice(1).map((line, i) => (line ? <p key={i}>{line}</p> : <div key={i} className="h-3" aria-hidden />))}
      </article>
    </div>
  );
}
