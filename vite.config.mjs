import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { port: 5173, open: false, host: true },
  build: {
    outDir: "dist",
    // Phaser 本身是一个大型单模块；它已由入口动态加载并独立缓存。
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "phaser-engine",
              test: /node_modules[\\/]phaser/,
              priority: 20,
            },
          ],
        },
      },
    },
  },
});
