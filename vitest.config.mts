import "dotenv/config";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // appointments.test.ts é integração contra o Supabase real (sem banco no CI).
    exclude: ["**/node_modules/**", ...(process.env.CI ? ["src/actions/appointments.test.ts"] : [])],
  },
});
