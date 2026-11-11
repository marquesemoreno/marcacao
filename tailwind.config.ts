import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // Paletas por extenso em src/lib (ex.: avatar-tone.ts).
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // Base visual estilo Apple (06/11/2026): Inter + fallback para a fonte do sistema.
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "system-ui", "Segoe UI", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      // Sombras bem suaves, sem contorno escuro.
      boxShadow: {
        xs: "0 1px 2px rgba(0,0,0,0.04)",
        sm: "0 1px 2px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.04)",
        md: "0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        lg: "0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)",
        xl: "0 16px 40px rgba(0,0,0,0.10), 0 4px 10px rgba(0,0,0,0.05)",
      },
      colors: {
        // Cinzas neutros da Apple no lugar do slate azulado — as 2.000+ classes slate-* do
        // sistema mudam juntas, sem tocar nas telas.
        slate: {
          50: "#fbfbfd",
          100: "#f5f5f7",
          200: "#e8e8ed",
          300: "#d2d2d7",
          400: "#aeaeb2",
          500: "#86868b",
          600: "#6e6e73",
          700: "#48484a",
          800: "#2c2c2e",
          900: "#1d1d1f",
          950: "#0b0b0c",
        },
        // Verde da marca um pouco mais fechado que o emerald-600 padrão (#059669). Com texto
        // branco o padrão dá contraste 3,8:1, abaixo do mínimo de 4,5:1 para texto de botão;
        // este dá 4,6:1. Vale para os ~120 botões `bg-emerald-600 text-white` de uma vez.
        emerald: {
          600: "#04865e",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
export default config;
