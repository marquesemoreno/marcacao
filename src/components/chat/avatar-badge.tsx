function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase());
  return initials.join("") || "?";
}

/** Iniciais geradas localmente em vez de foto — evita expor nome de paciente
 * real para um serviço externo de avatar (LGPD) e não depende de foto que não existe. */
export function AvatarBadge({
  name,
  size = 40,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 font-bold tracking-tight text-white shadow-2xs select-none transition-transform hover:scale-105 ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
    >
      {initialsFor(name)}
    </div>
  );
}

