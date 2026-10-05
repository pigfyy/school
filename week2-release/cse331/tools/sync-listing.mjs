// Copies tests/java/Sum.java (the lecture's 99-line listing, the file compare-java.mjs compiles and runs)
// into site/index.html's <script type="text/plain" id="src-sum">, so the page shows exactly the Java that
// was tested. Idempotent. Usage: node tools/sync-listing.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const base = join(dirname(fileURLToPath(import.meta.url)), "..");
const java = readFileSync(join(base, "tests", "java", "Sum.java"), "utf8").replace(/\n$/, "");
if (java.includes("</script")) throw new Error("listing can't contain </script");
const htmlPath = join(base, "site", "index.html");
const html = readFileSync(htmlPath, "utf8");
const re = /(<script type="text\/plain" id="src-sum">)[\s\S]*?(<\/script>)/;
if (!re.test(html)) throw new Error("no src-sum block in index.html");
const out = html.replace(re, (_, a, b) => `${a}\n${java}\n${b}`);
writeFileSync(htmlPath, out);
console.log(`listing: ${java.split("\n").length} lines of tests/java/Sum.java -> site/index.html#src-sum${out === html ? " (unchanged)" : ""}`);
