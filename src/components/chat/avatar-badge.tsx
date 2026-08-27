"use client";

import { useState } from "react";

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase());
  return initials.join("") || "?";
}

/** Mostra a foto de perfil real do WhatsApp quando disponível (buscada via
 * Evolution API, já com custódia de tudo mais dessa conversa — não é um
 * serviço externo novo). Cai pras iniciais quando não há foto, a URL expirou,
 * ou falhou ao carregar (onError). */
export function AvatarBadge({
  name,
  photoUrl,
  size = 40,
  className = "",
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showPhoto = Boolean(photoUrl) && !imageFailed;

  if (showPhoto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl!}
        alt={name}
        onError={() => setImageFailed(true)}
        className={`shrink-0 rounded-full object-cover shadow-2xs select-none transition-transform hover:scale-105 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 font-bold tracking-tight text-white shadow-2xs select-none transition-transform hover:scale-105 ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
    >
      {initialsFor(name)}
    </div>
  );
}
