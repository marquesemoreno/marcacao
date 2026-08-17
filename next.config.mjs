// Se NEXTAUTH_URL existir mas estiver vazia (string ""), não ausente — ex:
// uma env var configurada na Vercel com o campo de valor em branco — o
// next-auth v4 quebra o build inteiro. `parseUrl()` (node_modules/next-auth/
// utils/parse-url.js) só usa o valor padrão quando a URL é null/undefined;
// string vazia passa direto pra `new URL("")`, que lança
// `TypeError: Invalid URL` / `ERR_INVALID_URL` — reproduzido localmente e
// confirmado como a causa exata do erro de build. Isso roda em
// next.config.mjs porque é o primeiro código do projeto que a Next.js
// executa, antes de qualquer módulo (nosso ou do next-auth) ser importado —
// nem `src/lib/auth.ts` nem `src/middleware.ts` seriam cedo o suficiente,
// já que não sabemos qual dos dois o Next importa primeiro durante o build.
if (!process.env.NEXTAUTH_URL?.trim()) {
  delete process.env.NEXTAUTH_URL;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async redirects() {
    return [
      { source: "/admin/dashboard", destination: "/admin", permanent: true },
      { source: "/clinic/dashboard", destination: "/clinic", permanent: true },
    ];
  },
};

export default nextConfig;
