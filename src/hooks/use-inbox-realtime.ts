"use client";

import { useEffect, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase-client";

const DEFAULT_POLL_INTERVAL_MS = 5000;

/**
 * Mantém o inbox atualizado por dois caminhos, ao mesmo tempo:
 *
 * 1. Polling (`setInterval`) — sempre ativo, é a base funcional real.
 *    Funciona hoje, sem depender de nenhuma configuração extra.
 * 2. Supabase Realtime (`postgres_changes` em `messages`/`conversations`)
 *    — só ativa se NEXT_PUBLIC_SUPABASE_URL/ANON_KEY estiverem definidas
 *    E existirem policies de RLS liberando leitura (não existem por
 *    padrão — ver src/lib/supabase-client.ts). Quando funcionar, chama
 *    `onUpdate` imediatamente ao invés de esperar o próximo poll.
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
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () =>
        onUpdateRef.current()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () =>
        onUpdateRef.current()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [pollIntervalMs]);
}
