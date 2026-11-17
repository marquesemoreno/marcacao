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
  experimental: {
    // Padrão do Next é 1MB — baixo demais pras Server Actions que recebem imagem
    // direto do navegador (feedback de atendente, disparo em massa). 20MB dá folga
    // acima do limite de 15MB já validado no código pra esses uploads.
    serverActions: { bodySizeLimit: "20mb" },
  },
  // Cabeçalhos de segurança em todas as respostas (auditoria 16/11/2026, M7):
  // - frame-ancestors / X-Frame-Options: ninguém abre o painel dentro de um iframe
  //   (clique induzido que inicia campanha ou transfere conversa). Não afeta os iframes
  //   que NÓS abrimos (YouTube/Spotify na TV).
  // - nosniff: o navegador não "adivinha" o tipo de um arquivo.
  // - Referrer-Policy: o endereço completo (com token de /p, /tv…) não vai para outros sites.
  // - Permissions-Policy: microfone (áudio do Chat) e localização (QR de chegada, ponto
  //   da clínica) só para o próprio site; câmera e o resto, desligados.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(self), payment=(), usb=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/admin/dashboard", destination: "/admin", permanent: true },
      { source: "/clinic/dashboard", destination: "/clinic", permanent: true },
    ];
  },
};

export default nextConfig;
