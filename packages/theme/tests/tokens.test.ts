import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vite-plus/test";

const root = path.resolve(import.meta.dirname, "../../..");

function variables(css: string, pattern: RegExp): Map<string, string> {
  return new Map([...css.matchAll(pattern)].map((m) => [m[1]!, m[2]!.toLowerCase()]));
}

describe("design tokens", () => {
  it("match the web app's palette", () => {
    const mobile = variables(
      readFileSync(path.join(root, "packages/theme/tokens.css"), "utf8"),
      /--color-([a-z-]+):\s*(#[0-9a-f]{6});/gi,
    );
    const web = variables(
      readFileSync(path.join(root, "apps/web/src/styles.css"), "utf8"),
      /^\s+--([a-z-]+):\s*(#[0-9a-f]{6});/gim,
    );
    expect(mobile.size).toBeGreaterThan(20);
    for (const [name, value] of mobile) {
      expect({ name, value }).toEqual({ name, value: web.get(name) });
    }
  });
});
