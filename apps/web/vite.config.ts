import { defineConfig, loadEnv } from "vite-plus";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const WORKSPACE_ROOT = "../..";

export default defineConfig(({ mode }) => {
  // Server-side settings of the /api proxy, from the shared .env files (shell wins).
  const rootEnv = loadEnv(mode, WORKSPACE_ROOT, "");
  for (const name of ["API_URL", "TRUST_PROXY"]) {
    if (rootEnv[name] && process.env[name] === undefined) process.env[name] = rootEnv[name];
  }

  return {
    // .env files live at the workspace root, shared with the API and the worker.
    envDir: WORKSPACE_ROOT,
    resolve: { tsconfigPaths: true },
    server: { port: 3000, strictPort: true },
    plugins: [
      devtools(),
      nitro({ rollupConfig: { external: [/^@sentry\//] } }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
  };
});
