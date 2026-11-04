/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the CommonJS API used by legacy consumers. */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const minimatch = require("./index.cjs");

test("supports callable matching used by legacy ESLint plugins", () => {
  assert.equal(minimatch("src/components/card.tsx", "**/*.{ts,tsx}"), true);
  assert.equal(minimatch("src/components/card.js", "**/*.{ts,tsx}"), false);
  assert.equal(minimatch(".next/types/routes.ts", "**/*.ts"), false);
  assert.equal(minimatch(".next/types/routes.ts", "**/*.ts", { dot: true }), true);
  assert.equal(minimatch("Component", "Comp*", { noglobstar: true }), true);
});

test("preserves the helpers used by ESLint and import rules", () => {
  assert.equal(new minimatch.Minimatch("**/*.tsx").match("src/card.tsx"), true);
  assert.equal(minimatch.makeRe("src/**").test("src/card.tsx"), true);
  assert.deepEqual(minimatch.match(["card.tsx", "card.js"], "*.tsx"), ["card.tsx"]);
  assert.equal(minimatch.defaults({ nocase: true })("CARD.TSX", "*.tsx"), true);
});
