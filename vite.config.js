import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore", "firebase/messaging"],
          ai: ["@google/generative-ai"],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
