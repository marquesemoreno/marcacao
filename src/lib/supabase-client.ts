"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null | undefined;

/**
 * Cliente Supabase para uso no navegador (Realtime). Retorna `null` se
 * NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY não estiverem
 * configuradas — quem chama deve tratar isso como "Realtime desligado,
 * use o polling" (ver src/hooks/use-inbox-realtime.ts), nunca lançar erro.
 *
 * Mesmo configurado, sem policies de RLS em `conversations`/`messages`
 * (ver migration 20260816022709_add_inbox_module) nenhum evento chega —
 * é um "deny by default" deliberado. Ver
 * docs/obsidian/05 - Módulo de Atendimento e Chat Realtime.md.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  cachedClient = url && anonKey ? createClient(url, anonKey) : null;
  return cachedClient;
}
