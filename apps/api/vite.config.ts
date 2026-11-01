import { defineConfig } from "vite-plus";

// `vp pack` bundles the workspace packages (shipped as TypeScript source) into dist/;
// third-party dependencies stay external and are installed next to it.
export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    format: "esm",
    platform: "node",
    target: "node24",
    sourcemap: true,
    deps: { alwaysBundle: [/^@licita\//] },
  },
});
