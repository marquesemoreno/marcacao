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

function LogoIcon({ size, white, className }: { size: LogoSize; white: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn(iconSizeClasses[size], "shrink-0", className)}
      role="img"
      aria-label="Conecta Saúde"
    >
      <rect
        x="0"
        y="0"
        width="100"
        height="100"
        rx="28"
        fill={white ? "rgba(255,255,255,0.12)" : "#0f766e"}
        stroke={white ? "rgba(255,255,255,0.5)" : "none"}
        strokeWidth={white ? 2 : 0}
      />

      {/* Linha de pulso vital terminando em um ponto de conexão — "Conecta" */}
      <path
        d="M14 50 L30 50 L38 30 L48 70 L56 50 L70 50"
        fill="none"
        stroke="#ffffff"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="82" cy="50" r="6.5" fill="#ffffff" />
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
      <span className={cn("font-extrabold tracking-tight", brandTextClasses[size])}>
        <span className={isWhite ? "text-white" : "text-slate-900"}>Conecta</span>{" "}
        <span className={isWhite ? "text-white" : "text-teal-700"}>Saúde</span>
      </span>
    </span>
  );
}
