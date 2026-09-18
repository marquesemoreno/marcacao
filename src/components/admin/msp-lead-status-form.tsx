"use client";

import { useState } from "react";
import type { MspLeadStatus } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { updateMspLeadStatus } from "@/actions/msp-leads";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { mspLeadStatusLabels } from "@/lib/format";

const statusOptions: MspLeadStatus[] = ["NEW", "CONTACTED", "REPLIED", "NOT_INTERESTED"];

export function MspLeadStatusForm({ leadId, status }: { leadId: string; status: MspLeadStatus }) {
  const { isPending, run } = useActionFeedback();
  const [value, setValue] = useState<MspLeadStatus>(status);

  function handleSave() {
    run(() => updateMspLeadStatus(leadId, value), {
      successMessage: "Status atualizado.",
      errorMessage: "Não foi possível salvar. Tente novamente.",
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={(next) => next && setValue(next as MspLeadStatus)}>
        <SelectTrigger className="h-9 w-40">
          <SelectValue placeholder="Status">{() => mspLeadStatusLabels[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option} value={option}>
              {mspLeadStatusLabels[option]}
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
