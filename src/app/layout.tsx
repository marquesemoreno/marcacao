import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/components/session-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Conecta Saúde | Consultas e Exames em Vitória da Conquista",
  description:
    "A forma mais rápida e acessível de agendar consultas médicas, exames e procedimentos em clínicas parceiras de Vitória da Conquista.",
  openGraph: {
    title: "Conecta Saúde | Consultas e Exames em Vitória da Conquista",
    description:
      "A forma mais rápida e acessível de agendar consultas médicas, exames e procedimentos em clínicas parceiras de Vitória da Conquista.",
    siteName: "Conecta Saúde",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Conecta Saúde | Consultas e Exames em Vitória da Conquista",
    description:
      "A forma mais rápida e acessível de agendar consultas médicas, exames e procedimentos em clínicas parceiras de Vitória da Conquista.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={cn(
          geistSans.variable,
          geistMono.variable,
          "font-sans antialiased"
        )}
      >
        <SessionProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </SessionProvider>
        <Toaster />
      </body>
    </html>
  );
}
