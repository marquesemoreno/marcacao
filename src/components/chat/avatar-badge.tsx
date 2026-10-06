"use client";

import { useCallback, useState } from "react";
import { User } from "lucide-react";
import { avatarInitials } from "@/lib/avatar-initials";

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
  // Foto do WhatsApp expirada falha ANTES da hidratação quando a página vem do servidor:
  // o onError do React nunca dispara e o navegador mostra o texto alternativo. Confere o
  // estado da imagem assim que ela é montada.
  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth === 0) setImageFailed(true);
  }, []);
  const showPhoto = Boolean(photoUrl) && !imageFailed;

  if (showPhoto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={imgRef}
        src={photoUrl!}
        alt={name}
        onError={() => setImageFailed(true)}
        className={`shrink-0 rounded-full object-cover shadow-2xs select-none ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-emerald-700 font-bold tracking-tight text-white shadow-2xs select-none ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
    >
      {avatarInitials(name) || <User style={{ width: size * 0.5, height: size * 0.5 }} aria-hidden />}
    </div>
  );
}
