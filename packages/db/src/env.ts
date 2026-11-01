/**
 * Loads `.env.local` / `.env` from the workspace root for Node processes (API, worker,
 * scripts, tests). Variables already set in the environment win, so a shell override
 * such as `DATABASE_URL=… vp run dev` always takes precedence.
 */
import { existsSync } from "node:fs";
import path from "node:path";

import { config } from "dotenv";

function workspaceRoot(from = process.cwd()): string {
  let dir = path.resolve(from);
  while (!existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
  return dir;
}

let loaded = false;

export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  const root = workspaceRoot();
  config({ path: [path.join(root, ".env.local"), path.join(root, ".env")], quiet: true });
}

/** `DATABASE_URL`, required by every process that talks to PostgreSQL (Neon in production). */
export function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}
