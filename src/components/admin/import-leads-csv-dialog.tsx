"use client";

import { useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createPartnerLeadsFromCsv } from "@/actions/partner-leads";
import { parsePartnerLeadCsv, type ParsedPartnerLeadRow } from "@/lib/partner-lead-csv";

/** Importação em lote de leads via CSV — pra quando o admin já tem uma lista pronta
 * (planilha de indicações, evento etc.) em vez de cadastrar um por um. */
export function ImportLeadsCsvDialog() {
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<ParsedPartnerLeadRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  function handleCsvChange(value: string) {
    setCsvText(value);
    setParseError(null);
    if (!value.trim()) {
      setRows([]);
      return;
    }
    try {
      setRows(parsePartnerLeadCsv(value));
    } catch (error) {
      setRows([]);
      setParseError(error instanceof Error ? error.message : "CSV inválido.");
    }
  }

  function handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => handleCsvChange(String(reader.result ?? ""));
    reader.readAsText(file, "utf-8");
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const result = await createPartnerLeadsFromCsv(rows);
      if (result.created > 0) {
        toast.success(`${result.created} lead(s) importado(s).`);
      }
      if (result.errors.length > 0) {
        toast.error(
          `${result.errors.length} linha(s) com erro: ${result.errors.slice(0, 3).join("; ")}`
        );
      }
      if (result.errors.length === 0) {
        setCsvText("");
        setRows([]);
        setOpen(false);
      }
    } catch {
      toast.error("Não foi possível importar o CSV.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" />
        Importar CSV
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar leads via CSV</DialogTitle>
          <DialogDescription>
            Cabeçalho com as colunas: clinica, telefone, bairro (ou endereco) e especialidades (ou
            categoria) são obrigatórias. Contato e email são opcionais — útil pra listas vindas de
            extensão de scraping (Google Maps etc.), que não trazem essa informação. Aceita vírgula,
            ponto-e-vírgula ou colar direto de uma planilha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            Selecionar arquivo .csv
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
          </label>
          <Textarea
            rows={6}
            value={csvText}
            onChange={(e) => handleCsvChange(e.target.value)}
            placeholder={
              "clinica,contato,telefone,email,bairro,especialidades\nClínica Exemplo,João Silva,77999998888,joao@exemplo.com,Centro,Ortopedia"
            }
            className="font-mono text-xs"
          />
          {parseError && (
            <p className="text-xs font-semibold text-red-600 dark:text-red-400">{parseError}</p>
          )}
          {rows.length > 0 && !parseError && (
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {rows.length} lead(s) reconhecido(s) no arquivo.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleImport} disabled={importing || rows.length === 0}>
            {importing && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {importing ? "Importando..." : `Importar ${rows.length || ""} lead(s)`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
