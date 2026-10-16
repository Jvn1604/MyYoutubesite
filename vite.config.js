import { defineConfig } from "vite";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

const root = import.meta.dirname;

/**
 * Emits dist/_headers (CSP, HSTS…) only for real Netlify builds (CONTEXT = production,
 * deploy-preview, branch-deploy). Local builds skip it because `netlify dev` reads
 * dist/_headers too, and a strict CSP would block Vite's dev client.
 * Test locally with:  CONTEXT=production npm run build
 */
function productionHeaders() {
  return {
    name: "production-headers",
    apply: "build",
    generateBundle() {
      const context = process.env.CONTEXT;
      if (!context || context === "dev") return;
      this.emitFile({ type: "asset", fileName: "_headers", source: readFileSync(resolve(root, "netlify/production-headers"), "utf8") });
    },
  };
}

// Multi-page build: every HTML entry point is listed here.
export default defineConfig({
  root,
  appType: "mpa", // unknown routes 404 instead of falling back to index.html
  publicDir: "public",
  plugins: [productionHeaders()],
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
