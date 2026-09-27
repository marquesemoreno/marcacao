"use client";

import { useRef } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateClinicDefaultTicket, addAcquisitionRule, deleteAcquisitionRule } from "@/actions/clinic";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { ACQUISITION_CHANNELS, DIRECT_CHANNEL } from "@/lib/acquisition";

/** Ticket médio padrão + textos-chave de campanha — alimentam o Faturamento Estimado e o
 * filtro por Canal de Aquisição do /clinic/relatorio. */
export function ReportSettingsForm({
  defaultTicket,
  rules,
}: {
  defaultTicket: string | null;
  rules: { id: string; keyword: string; channel: string }[];
}) {
  const { isPending, run } = useActionFeedback();
  const ruleFormRef = useRef<HTMLFormElement>(null);
  const channels = ACQUISITION_CHANNELS.filter((c) => c !== DIRECT_CHANNEL);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ticket médio de consulta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Usado no Faturamento Estimado e na Receita Protegida dos relatórios quando o procedimento não tem preço
            cadastrado (ex: agendamentos vindos do sistema da clínica).
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(() => updateClinicDefaultTicket(fd), { successMessage: "Ticket médio atualizado." });
            }}
            className="flex items-end gap-2"
          >
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" name="defaultTicket" defaultValue={defaultTicket ?? ""} placeholder="Ex: 250" className="h-9" />
            </div>
            <Button type="submit" size="sm" disabled={isPending}>
              Salvar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Textos de campanha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Se a 1ª mensagem do paciente contiver o texto (ex: o texto pré-preenchido do link do anúncio), a conversa é
            marcada com o canal escolhido. Anúncios de clique para WhatsApp do Meta já são reconhecidos automaticamente.
          </p>
          {rules.length > 0 && (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-md border border-slate-200 dark:border-slate-800">
              {rules.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                  <span className="truncate">
                    “{r.keyword}” → <strong>{r.channel}</strong>
                  </span>
                  <button
                    type="button"
                    aria-label={`Remover ${r.keyword}`}
                    disabled={isPending}
                    onClick={() => run(() => deleteAcquisitionRule(r.id), { successMessage: "Texto removido." })}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            ref={ruleFormRef}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(() => addAcquisitionRule(fd), {
                successMessage: "Texto de campanha adicionado.",
                errorMessage: "Preencha o texto (mín. 3 caracteres) e o canal.",
                onSuccess: () => ruleFormRef.current?.reset(),
              });
            }}
            className="grid grid-cols-[1fr_auto_auto] items-end gap-2"
          >
            <div className="space-y-1">
              <Label className="text-xs">Texto</Label>
              <Input name="keyword" placeholder="Ex: promoção de check-up" className="h-9" required minLength={3} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Canal</Label>
              <select name="channel" className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm">
                {channels.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm" disabled={isPending}>
              Adicionar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
