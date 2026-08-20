import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/components/session-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://conectasaudevc.com.br"),
  title: "Conecta Saúde | Consultas e Exames Perto de Você",
  description:
    "A forma mais rápida e acessível de agendar consultas médicas e exames em clínicas parceiras.",
  openGraph: {
    title: "Conecta Saúde | Consultas e Exames Perto de Você",
    description:
      "A forma mais rápida e acessível de agendar consultas médicas e exames em clínicas parceiras.",
    url: "https://conectasaudevc.com.br",
    siteName: "Conecta Saúde",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Conecta Saúde | Consultas e Exames Perto de Você",
    description:
      "A forma mais rápida e acessível de agendar consultas médicas e exames em clínicas parceiras.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="scroll-smooth" suppressHydrationWarning>
      <body
        className={cn(
          geistSans.variable,
          geistMono.variable,
          "font-sans antialiased bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
        )}
      >
        <SessionProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <TooltipProvider>{children}</TooltipProvider>
          </ThemeProvider>
        </SessionProvider>
        <Toaster />
      </body>
    </html>
  );
}
