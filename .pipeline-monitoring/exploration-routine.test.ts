import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { globToRegex } from "./exploration-routine.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function run(args: string[]): { code: number; stdout: string; stderr: string } {
  const script = path.resolve(HERE, "exploration-routine.ts");
  const res = spawnSync("npx", ["tsx", script, ...args], {
    encoding: "utf8",
  });
  return {
    code: res.status ?? -1,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

test("globToRegex: *.ts does not match files without a literal dot", () => {
  const re = new RegExp("^" + globToRegex("*.ts") + "$");
  assert.equal(re.test("a.ts"), true);
  assert.equal(re.test("axts"), false);
});

test("globToRegex: *.ts does not cross path separators", () => {
  const re = new RegExp("^" + globToRegex("*.ts") + "$");
  assert.equal(re.test("sub/a.ts"), false);
});

test("globToRegex: **/*.ts matches at arbitrary depth", () => {
  const re = new RegExp("^" + globToRegex("**/*.ts") + "$");
  assert.equal(re.test("a.ts"), true);
  assert.equal(re.test("sub/a.ts"), true);
  assert.equal(re.test("a/b/c/deep.ts"), true);
  assert.equal(re.test("deep.txt"), false);
});

test("globToRegex: ? matches exactly one non-separator character", () => {
  const re = new RegExp("^" + globToRegex("?.ts") + "$");
  assert.equal(re.test("a.ts"), true);
  assert.equal(re.test("ab.ts"), false);
  assert.equal(re.test("/.ts"), false);
});

test("globToRegex: regex metacharacters in glob are escaped literally", () => {
  const re = new RegExp("^" + globToRegex("foo+bar(1).ts") + "$");
  assert.equal(re.test("foo+bar(1).ts"), true);
  assert.equal(re.test("fooXbar1.ts"), false);
});

test("CLI: rejects invalid --mode value", () => {
  const { code, stdout, stderr } = run([
    "--pattern",
    "*.ts",
    "--mode",
    "banana",
  ]);
  assert.equal(code, 1);
  assert.match(stdout + stderr, /Invalid value for --mode/);
});

test("CLI: deep search returns matches (cache path)", () => {
  const root = mkdtempSync(path.join(tmpdir(), "exploration-test-"));
  writeFileSync(path.join(root, "a.ts"), "hello\nNEEDLE found here\nworld\n");
  writeFileSync(path.join(root, "b.ts"), "no match\n");

  const { code, stdout } = run([
    "--root",
    root,
    "--pattern",
    "*.ts",
    "--mode",
    "deep",
    "--search",
    "NEEDLE",
  ]);
  assert.equal(code, 0);
  const result = JSON.parse(stdout);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].path, "a.ts");
  assert.equal(result.matches[0].line, 2);
});

test("CLI: .env exclude is segment-based, not substring-based", () => {
  const root = mkdtempSync(path.join(tmpdir(), "exploration-test-"));
  mkdirSync(path.join(root, ".env"));
  writeFileSync(path.join(root, ".env", "secret.ts"), "x");
  writeFileSync(path.join(root, "environment.ts"), "y");

  const { code, stdout } = run([
    "--root",
    root,
    "--pattern",
    "**/*.ts",
  ]);
  assert.equal(code, 0);
  const result = JSON.parse(stdout);
  const paths = result.files.map((f: { path: string }) => f.path);
  assert.ok(paths.includes("environment.ts"));
  assert.ok(!paths.some((p: string) => p.startsWith(".env/")));
});
