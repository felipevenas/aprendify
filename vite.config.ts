import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          id = id.replace(/\\/g, "/");
          if (id.includes("node_modules")) {
            if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) {
              return "vendor-react";
            }
            if (id.includes("@radix-ui")) {
              return "vendor-ui";
            }
            if (id.includes("recharts")) {
              return "vendor-charts";
            }
            if (id.includes("framer-motion")) {
              return "vendor-motion";
            }
            if (id.includes("@supabase")) {
              return "vendor-supabase";
            }
          }
        },
      },
    },
  },
}));
