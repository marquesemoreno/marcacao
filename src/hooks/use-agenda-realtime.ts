"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase-client";
import { getAgendaRealtimeTopic } from "@/actions/agenda";

/** Agenda ao vivo: quando a recepção (outra tela) ou o paciente ("Cheguei", ficha) muda
 * algo, chega um aviso e a tela recarrega em ~1 s. Sem Realtime, fica o polling de 90 s. */
export function useAgendaRealtime(onChange: () => void): boolean {
  const [live, setLive] = useState(false);
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    getAgendaRealtimeTopic()
      .then((topic) => {
        if (cancelled || !topic) return;
        channel = supabase
          .channel(topic)
          .on("broadcast", { event: "changed" }, () => {
            clearTimeout(timer);
            timer = setTimeout(() => cb.current(), 800);
          })
          .subscribe((status) => setLive(status === "SUBSCRIBED"));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
      setLive(false);
    };
  }, []);
  return live;
}
