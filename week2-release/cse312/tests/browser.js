"use strict";
// Launch headless Chromium. Uses CHROMIUM_PATH, then Playwright's own browser, then any cached
// headless shell under ~/.cache/ms-playwright (so the tests run without a fresh browser download).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright-core");
function cachedShell() {
  const dir = path.join(os.homedir(), ".cache/ms-playwright");
  if (!fs.existsSync(dir)) return null;
  for (const d of fs.readdirSync(dir).filter((x) => x.startsWith("chromium_headless_shell-")).sort().reverse()) {
    const bin = path.join(dir, d, "chrome-headless-shell-linux64", "chrome-headless-shell");
    if (fs.existsSync(bin)) return bin;
  }
  return null;
}
async function launch() {
  if (process.env.CHROMIUM_PATH) return chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  try { return await chromium.launch(); } catch (e) {
    const bin = cachedShell();
    if (!bin) throw e;
    return chromium.launch({ executablePath: bin });
  }
}
module.exports = { launch };
