import { defineConfig } from "vite";
import { resolve } from "node:path";

const root = import.meta.dirname;

// Multi-page build: every HTML entry point is listed here.
export default defineConfig({
  root,
  appType: "mpa", // unknown routes 404 instead of falling back to index.html
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: resolve(root, "index.html"),
        notFound: resolve(root, "404.html"),
        admin: resolve(root, "admin/index.html"),
        adminLogin: resolve(root, "admin/login.html"),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Page is served through `netlify dev` on :8888; connect HMR straight to Vite.
    hmr: { clientPort: 5173 },
  },
});
