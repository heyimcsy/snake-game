import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub-Pages-friendly relative base so the build works from any subpath.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
