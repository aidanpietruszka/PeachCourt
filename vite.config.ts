import legacy from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import pkg from "./package.json";

export default defineConfig({
  plugins: [react(), legacy()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
