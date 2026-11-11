"use client";

import { useEffect, useState } from "react";
import { checkSessionAfterError } from "@/lib/session-guard-client";

/** Contadores do menu (não lidas do Chat e tarefas para hoje), com UM pedido compartilhado por
 * todas as instâncias do menu na tela (a versão celular e a de computador ficam montadas
 * juntas). Atualiza a cada minuto e quando a aba volta a ficar visível — não a cada troca de
 * página. */
const POLL_MS = 60_000;
type Counts = { unread: number; tasks: number };
let value: Counts = { unread: 0, tasks: 0 };
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;
const listeners = new Set<(c: Counts) => void>();

async function load() {
  if (inFlight || (typeof document !== "undefined" && document.visibilityState === "hidden")) return;
  inFlight = true;
  try {
    const res = await fetch("/api/chat/unread-count", { cache: "no-store" });
    if (res.status === 401) {
      void checkSessionAfterError();
      return;
    }
    const j = (await res.json()) as { count: number | null; tasks?: number | null };
    const next = { unread: typeof j.count === "number" ? j.count : value.unread, tasks: typeof j.tasks === "number" ? j.tasks : value.tasks };
    if (next.unread !== value.unread || next.tasks !== value.tasks) {
      value = next;
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

function useMenuCounts(): Counts {
  const [c, setC] = useState(value);
  useEffect(() => {
    listeners.add(setC);
    if (listeners.size === 1) {
      void load();
      timer = setInterval(load, POLL_MS);
      document.addEventListener("visibilitychange", onVisible);
    }
    return () => {
      listeners.delete(setC);
      if (listeners.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, []);
  return c;
}

export function useUnreadCount(): number {
  return useMenuCounts().unread;
}

/** Tarefas abertas, minhas ou sem responsável, atrasadas ou para hoje. */
export function useTaskCount(): number {
  return useMenuCounts().tasks;
}

/** Pede os contadores de novo agora (ex.: depois de concluir ou criar uma tarefa). */
export function refreshMenuCounts(): void {
  void load();
}
