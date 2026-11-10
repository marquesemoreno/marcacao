import { cn } from "@/lib/utils";

/** Bloco cinza pulsante usado nos `loading.tsx` enquanto o servidor monta a página. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-slate-200/70 dark:bg-slate-700/40", className)} {...props} />;
}
