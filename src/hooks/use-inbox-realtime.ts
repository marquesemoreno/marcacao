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
 * `topic`: nome do canal calculado no servidor (getInboxRealtimeChannelName, HMAC — auditoria
 * B5); sem ele, só o recarregamento periódico. Antes era `clinicId`: passa o da própria clínica (scope="clinic") pra só ouvir
 * mudanças dela — sem isso (scope="admin", que enxerga todas as clínicas
 * juntas), ouve o canal geral do admin. Antes disso era um único canal global
 * pra todo mundo: toda mensagem de qualquer clínica acordava toda aba aberta de
 * toda outra clínica, ampliando o mesmo padrão de polling que já tinha estourado
 * o Egress do Supabase.
 */
/** Intervalo mínimo entre duas atualizações seguidas. Em campanha chegavam ~13 avisos por
 * minuto (26/11) e cada um disparava a busca inteira na hora — as buscas (Server Actions)
 * rodam uma de cada vez, formavam fila, e abrir uma conversa esperava atrás delas. */
const MIN_GAP_MS = 2500;

export function useInboxRealtime(onUpdate: () => unknown, topic?: string | null, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    let running = false;
    let pending = false;
    let lastRun = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    // Junta avisos: no máximo uma atualização em andamento; os que chegam no meio viram
    // UMA atualização a mais, depois de MIN_GAP_MS. Com a aba escondida não busca nada —
    // atualiza uma vez quando a atendente volta pra ela.
    const trigger = () => {
      if (disposed) return;
      if (running || timer || document.hidden) {
        pending = true;
        return;
      }
      const wait = Math.max(0, lastRun + MIN_GAP_MS - Date.now());
      if (wait > 0) {
        pending = true;
        timer = setTimeout(() => {
          timer = null;
          flush();
        }, wait);
        return;
      }
      run();
    };
    const flush = () => {
      if (!pending) return;
      pending = false;
      trigger();
    };
    const run = async () => {
      running = true;
      lastRun = Date.now();
      try {
        await onUpdateRef.current();
      } catch {
        // a próxima atualização tenta de novo
      } finally {
        running = false;
        lastRun = Date.now();
        flush();
      }
    };
    const onVisible = () => {
      if (!document.hidden) flush();
    };
    document.addEventListener("visibilitychange", onVisible);

    const interval = setInterval(trigger, pollIntervalMs);

    const supabase = getSupabaseClient();
    const channel = supabase && topic ? supabase.channel(topic).on("broadcast", { event: "changed" }, trigger).subscribe() : null;

    return () => {
      disposed = true;
      clearInterval(interval);
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      if (supabase && channel) supabase.removeChannel(channel);
    };
  }, [pollIntervalMs, topic]);
}
