"use client";

import { useEffect, useState } from "react";
import { checkSessionAfterError } from "@/lib/session-guard-client";

/** Não lidas do menu, com UM pedido compartilhado por todas as instâncias do menu na
 * tela (a versão celular e a de computador ficam montadas juntas). Atualiza a cada
 * minuto e quando a aba volta a ficar visível — não a cada troca de página. */
const POLL_MS = 60_000;
let value = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;
const listeners = new Set<(n: number) => void>();

async function load() {
  if (inFlight || (typeof document !== "undefined" && document.visibilityState === "hidden")) return;
  inFlight = true;
  try {
    const res = await fetch("/api/chat/unread-count", { cache: "no-store" });
    if (res.status === 401) {
      void checkSessionAfterError();
      return;
    }
    const j = (await res.json()) as { count: number | null };
    if (typeof j.count === "number") {
      value = j.count;
      listeners.forEach((l) => l(value));
    }
  } catch {
    // mantém o último valor
  } finally {
    inFlight = false;
  }
}

function onVisible() {
  if (document.visibilityState === "visible") void load();
}

export function useUnreadCount(): number {
  const [n, setN] = useState(value);
  useEffect(() => {
    listeners.add(setN);
    if (listeners.size === 1) {
      void load();
      timer = setInterval(load, POLL_MS);
      document.addEventListener("visibilitychange", onVisible);
    }
    return () => {
      listeners.delete(setN);
      if (listeners.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, []);
  return n;
}
