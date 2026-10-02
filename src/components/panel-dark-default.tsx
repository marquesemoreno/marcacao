"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

/** Tema escuro como padrão do painel (/clinic, /admin) sem mudar o site dos pacientes —
 * o ThemeProvider é um só pro app inteiro (defaultTheme "system"). Só age se a pessoa
 * nunca escolheu um tema: escolha explícita (menu do usuário) sempre vence. */
export function PanelDarkDefault() {
  const { setTheme } = useTheme();
  useEffect(() => {
    if (!localStorage.getItem("theme")) setTheme("dark");
  }, [setTheme]);
  return null;
}
