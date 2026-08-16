"use client";

import type { PartnerLeadStatus } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { updatePartnerLeadStatus } from "@/actions/partner-leads";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { partnerLeadStatusLabels } from "@/lib/format";
import { useState } from "react";

const statusOptions: PartnerLeadStatus[] = ["NEW", "CONTACTED", "PARTNER", "REJECTED"];

export function PartnerLeadStatusForm({
  leadId,
  status,
}: {
  leadId: string;
  status: PartnerLeadStatus;
}) {
  const { isPending, run } = useActionFeedback();
  const [value, setValue] = useState<PartnerLeadStatus>(status);

  function handleSave() {
    run(() => updatePartnerLeadStatus(leadId, value), {
      successMessage: "Status atualizado.",
      errorMessage: "Não foi possível salvar. Tente novamente.",
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={(next) => next && setValue(next as PartnerLeadStatus)}>
        <SelectTrigger className="h-9 w-40">
          <SelectValue placeholder="Status">{() => partnerLeadStatusLabels[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option} value={option}>
              {partnerLeadStatusLabels[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" onClick={handleSave} disabled={isPending || value === status}>
        {isPending ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  );
}
