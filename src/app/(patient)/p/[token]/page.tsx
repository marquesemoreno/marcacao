import type { Metadata } from "next";
import { loadPatientPortal } from "@/actions/patient-portal";
import { PatientPortal } from "@/components/patient/patient-portal";
import { loadNpsSurvey } from "@/actions/patient-nps";
import { NpsSurvey } from "@/components/patient/nps-survey";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sua consulta | Conecta Saúde",
  // Link pessoal: nunca indexar nem mandar o endereço pra outros sites.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PatientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await loadPatientPortal(token);
  // Não é link de consulta: pode ser o da pesquisa de satisfação.
  if (data.state === "NOT_FOUND") {
    const nps = await loadNpsSurvey(token);
    if (nps.state === "VALID" || nps.state === "ANSWERED") {
      return (
        <main className="mx-auto min-h-screen max-w-lg bg-slate-50 px-4 py-6 text-slate-900">
          {nps.state === "VALID" ? (
            <NpsSurvey token={token} clinicName={nps.clinicName} />
          ) : (
            <div className="mt-16 rounded-xl border border-slate-200 bg-white p-6 text-center">
              <h1 className="text-lg font-semibold">Resposta já enviada</h1>
              <p className="mt-2 text-sm text-slate-600">Obrigado por responder!</p>
            </div>
          )}
        </main>
      );
    }
  }
  return (
    <main className="mx-auto min-h-screen max-w-lg bg-slate-50 px-4 py-6 text-slate-900">
      {data.state === "VALID" ? (
        <PatientPortal token={token} data={data} />
      ) : (
        <div className="mt-16 rounded-xl border border-slate-200 bg-white p-6 text-center">
          <h1 className="text-lg font-semibold">
            {data.state === "EXPIRED" ? "Este link expirou" : data.state === "USED" || data.state === "REVOKED" ? "Este link não vale mais" : "Link não encontrado"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">Se precisar, fale com a clínica pelo WhatsApp que ela manda um novo.</p>
        </div>
      )}
    </main>
  );
}
