import { defineConfig } from "vite";

// 画面だけをビルドする. Worker のほうは wrangler がビルドする.
export default defineConfig({
  root: "src/client",
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
});
