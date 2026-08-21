"use client";

import { useEffect, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase-client";

const DEFAULT_POLL_INTERVAL_MS = 5000;

/**
 * Mantém o inbox atualizado por dois caminhos, ao mesmo tempo:
 *
 * 1. Polling (`setInterval`) — sempre ativo, é a base funcional real.
 *    Funciona hoje, sem depender de nenhuma configuração extra.
 * 2. Supabase Realtime Broadcast (canal "inbox-changes", evento "changed")
 *    — só ativa se NEXT_PUBLIC_SUPABASE_URL/ANON_KEY estiverem definidas.
 *    Deliberadamente NÃO usa `postgres_changes`: isso exigiria RLS liberando
 *    leitura das tabelas messages/conversations pra role `anon` (que é
 *    pública, embutida no bundle do navegador), vazando dado de saúde de
 *    todos os pacientes pra qualquer um com a anon key. Broadcast não
 *    depende de RLS — o servidor só manda um sinal vazio (ver
 *    notifyInboxRealtime em src/lib/supabase-server.ts) e quem escuta
 *    refaz a busca pela mesma Server Action de sempre. Quando o sinal
 *    chega, chama `onUpdate` imediatamente ao invés de esperar o próximo poll.
 */
export function useInboxRealtime(onUpdate: () => void, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const interval = setInterval(() => onUpdateRef.current(), pollIntervalMs);

    const supabase = getSupabaseClient();
    if (!supabase) {
      return () => clearInterval(interval);
    }

    const channel = supabase
      .channel("inbox-changes")
      .on("broadcast", { event: "changed" }, () => onUpdateRef.current())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [pollIntervalMs]);
}
