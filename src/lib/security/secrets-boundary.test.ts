import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(process.cwd(), "src");

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(p);
  }
  return acc;
}

function isClientComponent(source: string): boolean {
  return /^["']use client["']/m.test(source.slice(0, 500));
}

describe("secrets / server-only boundary", () => {
  it("marks supabase admin as server-only", () => {
    const src = readFileSync(
      join(ROOT, "lib/supabase/admin.ts"),
      "utf8"
    );
    expect(src).toMatch(/import\s+["']server-only["']/);
    expect(src).not.toMatch(/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE/);
    expect(src).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("does not expose service role via NEXT_PUBLIC_ in tracked env example", () => {
    const example = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    expect(example).not.toMatch(/NEXT_PUBLIC_.*SERVICE_ROLE/);
    expect(example).not.toMatch(/NEXT_PUBLIC_DATABASE_URL/);
    expect(example).toMatch(/^SUPABASE_SERVICE_ROLE_KEY=/m);
  });

  it("client components do not value-import supabase admin", () => {
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      const src = readFileSync(file, "utf8");
      if (!isClientComponent(src)) continue;
      // Ignore import type lines
      const lines = src.split("\n");
      for (const line of lines) {
        if (/^\s*import\s+type\b/.test(line)) continue;
        if (
          /from\s+["']@\/lib\/supabase\/admin["']/.test(line) ||
          /createAdminClient/.test(line)
        ) {
          offenders.push(`${relative(process.cwd(), file)}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("gitignore covers env and key material patterns", () => {
    const gi = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
    for (const pattern of [
      ".env",
      ".env.*",
      "!.env.example",
      "*.pem",
      "*.key",
      "*.p12",
      "*.pfx",
    ]) {
      expect(gi).toContain(pattern);
    }
  });
});
