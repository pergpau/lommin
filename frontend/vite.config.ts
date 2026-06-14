import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Loads .env / .env.local (the latter is gitignored). Empty prefix so
  // VITE_ALLOWED_HOSTS is readable here in the config.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      // Restrict the dev server's accepted Host header to prevent DNS-rebinding
      // attacks. Defaults to localhost only. When testing the OAuth redirect
      // through a tunnel (e.g. ngrok), set VITE_ALLOWED_HOSTS in
      // frontend/.env.local as a comma-separated list, e.g.
      // VITE_ALLOWED_HOSTS=abc123.ngrok-free.app
      allowedHosts: env.VITE_ALLOWED_HOSTS
        ? env.VITE_ALLOWED_HOSTS.split(",")
            .map((h) => h.trim())
            .filter(Boolean)
        : ["localhost", "127.0.0.1"],
    },
  };
});
