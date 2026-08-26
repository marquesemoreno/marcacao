"use client";

import { useEffect, useRef } from "react";

/**
 * Fecha um menu/dropdown ao clicar fora dele ou apertar Esc — sem isso, menus
 * flutuantes (filtro, "...", respostas rápidas) só fechavam clicando de novo
 * no próprio botão que abriu, contrariando o comportamento padrão esperado.
 */
export function useClickOutside<T extends HTMLElement>(isOpen: boolean, onClose: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return ref;
}
