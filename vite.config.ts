import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: true,
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    define: {
      'process.env.TSS_PRERENDERING': '"false"',
      'process.env.TSS_SHELL': '"false"',
    },
  },
});