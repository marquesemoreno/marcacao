import { redirect } from "next/navigation";

/** Financeiro e estoque agora são abas de Relatórios (09/11/2026); mantém links antigos. */
export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  redirect(`/clinic/relatorio?aba=financeiro${mes ? `&mes=${encodeURIComponent(mes)}` : ""}`);
}
