"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreateAppointmentShortcut } from "./create-appointment-shortcut";
import type { ConversationDetail } from "./types";

const SUGGESTED_TAGS = ["Exame Pendente", "Retorno", "Prioritário", "Confirmado"];

export function ContactPanel({
  conversation,
  onUpdateTags,
}: {
  conversation: ConversationDetail;
  onUpdateTags: (tags: string[]) => Promise<void>;
}) {
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);

  async function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || conversation.tags.includes(trimmed)) return;
    setSaving(true);
    try {
      await onUpdateTags([...conversation.tags, trimmed]);
      setNewTag("");
    } catch {
      toast.error("Não foi possível adicionar a tag.");
    } finally {
      setSaving(false);
    }
  }

  async function removeTag(tag: string) {
    setSaving(true);
    try {
      await onUpdateTags(conversation.tags.filter((t) => t !== tag));
    } catch {
      toast.error("Não foi possível remover a tag.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollArea className="h-full border-l">
      <div className="flex flex-col gap-6 p-4">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Paciente</h3>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Nome: </span>
              {conversation.contact.name}
            </p>
            <p>
              <span className="text-muted-foreground">Telefone: </span>
              {conversation.contact.phone}
            </p>
            <p>
              <span className="text-muted-foreground">CPF: </span>
              {conversation.contact.cpf ?? "—"}
            </p>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Tags</h3>
          <div className="flex flex-wrap gap-1.5">
            {conversation.tags.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma tag ainda.</p>
            )}
            {conversation.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button type="button" onClick={() => removeTag(tag)} disabled={saving}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            <Input
              value={newTag}
              onChange={(event) => setNewTag(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTag(newTag);
                }
              }}
              placeholder="Nova tag..."
              className="h-8 text-sm"
              disabled={saving}
            />
            <Button size="sm" variant="outline" onClick={() => addTag(newTag)} disabled={saving || !newTag.trim()}>
              Adicionar
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTED_TAGS.filter((tag) => !conversation.tags.includes(tag)).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                disabled={saving}
                className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
              >
                + {tag}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Ações rápidas</h3>
          <CreateAppointmentShortcut
            contact={{
              name: conversation.contact.name,
              phone: conversation.contact.phone,
              cpf: conversation.contact.cpf,
            }}
          />
        </section>
      </div>
    </ScrollArea>
  );
}
