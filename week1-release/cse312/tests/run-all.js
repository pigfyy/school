"use strict";
// Regenerates export/ and runs every test suite in order. Exit code is non-zero if any suite fails.
const { spawnSync } = require("child_process");
const path = require("path");
const root = path.resolve(__dirname, "..");
const steps = [
  ["build export", ["scripts/build-inventory.js"]],
  ["answers", ["tests/answers.test.js"]],
  ["store", ["tests/store.test.js"]],
  ["inventory", ["scripts/build-inventory.js", "--check"]],
  ["browser", ["tests/browser.test.js"]],
];
let failed = 0;
for (const [name, args] of steps) {
  console.log(`\n=== ${name}`);
  const r = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  if (r.status !== 0) { failed++; console.log(`=== ${name}: FAILED`); }
}
console.log(failed ? `\n${failed} suite(s) failed` : "\nall suites passed");
process.exit(failed ? 1 : 0);
