import { useId } from "react";
import { cn } from "@/lib/utils";

type LogoVariant = "full" | "icon-only" | "white";
type LogoSize = "sm" | "md" | "lg";

const iconSizeClasses: Record<LogoSize, string> = {
  sm: "h-7 w-7",
  md: "h-10 w-10",
  lg: "h-14 w-14",
};

const brandTextClasses: Record<LogoSize, string> = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
};

const subtitleTextClasses: Record<LogoSize, string> = {
  sm: "text-[8px]",
  md: "text-[10px]",
  lg: "text-xs",
};

function LogoIcon({ size, white, className }: { size: LogoSize; white: boolean; className?: string }) {
  const gradientId = useId();

  return (
    <svg
      viewBox="0 0 100 100"
      className={cn(iconSizeClasses[size], "shrink-0", className)}
      role="img"
      aria-label="Conecta Saúde"
    >
      {!white && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
        </defs>
      )}

      <rect
        x="0"
        y="0"
        width="100"
        height="100"
        rx="28"
        fill={white ? "rgba(255,255,255,0.12)" : `url(#${gradientId})`}
        stroke={white ? "rgba(255,255,255,0.5)" : "none"}
        strokeWidth={white ? 2 : 0}
      />

      {/* 4 pontos de conexão — rede de saúde conectada */}
      <circle cx="22" cy="22" r="4.5" fill={white ? "#fff" : "rgba(255,255,255,0.85)"} />
      <circle cx="78" cy="22" r="4.5" fill={white ? "#fff" : "rgba(255,255,255,0.85)"} />
      <circle cx="22" cy="78" r="4.5" fill={white ? "#fff" : "rgba(255,255,255,0.85)"} />
      <circle cx="78" cy="78" r="4.5" fill={white ? "#fff" : "rgba(255,255,255,0.85)"} />

      {/* Linha de pulso vital / batimento cardíaco */}
      <path
        d="M14 50 L34 50 L42 28 L52 72 L60 50 L86 50"
        fill="none"
        stroke="#ffffff"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  variant = "full",
  size = "md",
}: {
  className?: string;
  variant?: LogoVariant;
  size?: LogoSize;
}) {
  if (variant === "icon-only") {
    return <LogoIcon size={size} white={false} className={className} />;
  }

  const isWhite = variant === "white";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoIcon size={size} white={isWhite} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-extrabold tracking-tight", brandTextClasses[size])}>
          <span className={isWhite ? "text-white" : "text-slate-900"}>Conecta</span>{" "}
          <span
            className={
              isWhite
                ? "text-white"
                : "bg-gradient-to-r from-sky-600 to-teal-600 bg-clip-text text-transparent"
            }
          >
            Saúde
          </span>
        </span>
        <span
          className={cn(
            "font-semibold uppercase tracking-wider",
            subtitleTextClasses[size],
            isWhite ? "text-white/70" : "text-slate-500"
          )}
        >
          Consultas & Exames
        </span>
      </span>
    </span>
  );
}
