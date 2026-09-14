"use client";

import { useEffect, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase-client";

// Era 5s — com o Realtime Broadcast (abaixo) já entregando update instantâneo em
// toda mudança de verdade, esse polling é só uma rede de segurança pro caso raro
// de o broadcast falhar/não estar configurado. Em 5s, cada aba aberta de inbox
// refaz a busca inteira (conversas + mensagens) 720x/hora — foi o que estourou o
// Egress do Supabase (226% do limite do plano Free em poucos dias). 30s reduz
// esse tráfego de fundo em 6x sem perder a atualização "de verdade" (que continua
// instantânea via broadcast).
const DEFAULT_POLL_INTERVAL_MS = 30000;

/**
 * Mantém o inbox atualizado por dois caminhos, ao mesmo tempo:
 *
 * 1. Polling (`setInterval`) — rede de segurança, não a via principal (ver nota
 *    acima). Funciona hoje, sem depender de nenhuma configuração extra.
 * 2. Supabase Realtime Broadcast (canal por clínica, evento "changed") — só
 *    ativa se NEXT_PUBLIC_SUPABASE_URL/ANON_KEY estiverem definidas.
 *    Deliberadamente NÃO usa `postgres_changes`: isso exigiria RLS liberando
 *    leitura das tabelas messages/conversations pra role `anon` (que é
 *    pública, embutida no bundle do navegador), vazando dado de saúde de
 *    todos os pacientes pra qualquer um com a anon key. Broadcast não
 *    depende de RLS — o servidor só manda um sinal vazio (ver
 *    notifyInboxRealtime em src/lib/supabase-server.ts) e quem escuta
 *    refaz a busca pela mesma Server Action de sempre. Quando o sinal
 *    chega, chama `onUpdate` imediatamente ao invés de esperar o próximo poll.
 *
 * `clinicId`: passa o da própria clínica (scope="clinic") pra só ouvir
 * mudanças dela — sem isso (scope="admin", que enxerga todas as clínicas
 * juntas), ouve o canal geral do admin. Antes disso era um único canal global
 * pra todo mundo: toda mensagem de qualquer clínica acordava toda aba aberta de
 * toda outra clínica, ampliando o mesmo padrão de polling que já tinha estourado
 * o Egress do Supabase.
 */
export function useInboxRealtime(onUpdate: () => void, clinicId?: string, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const interval = setInterval(() => onUpdateRef.current(), pollIntervalMs);

    const supabase = getSupabaseClient();
    if (!supabase) {
      return () => clearInterval(interval);
    }

    const channelName = clinicId ? `inbox-changes:${clinicId}` : "inbox-changes:admin";
    const channel = supabase
      .channel(channelName)
      .on("broadcast", { event: "changed" }, () => onUpdateRef.current())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [pollIntervalMs, clinicId]);
}
