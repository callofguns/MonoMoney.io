/* Bundles index.html + css + js into one self-contained page.
   Output: dist/monomoney.html — used for the shareable Artifact build.
   Run: node tools/build-artifact.mjs */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");

const html = read("index.html");
const grab = (re) => [...html.matchAll(re)].map((m) => m[1]);

const css = grab(/<link rel="stylesheet" href="([^"]+)"/g);
const js = grab(/<script src="([^"]+)"><\/script>/g);

const body = html
  .slice(html.indexOf("<body>") + 6, html.indexOf("</body>"))
  .replace(/\s*<script src="[^"]+"><\/script>/g, "")
  .trim();

const title = html.match(/<title>([^<]+)<\/title>/)[1];
const desc = html.match(/name="description" content="([^"]+)"/)[1];

const out = `<title>${title}</title>
<meta name="description" content="${desc}" />
<style>
${css.map((f) => `/* ── ${f} ── */\n${read(f)}`).join("\n\n")}
</style>

${body}

<script>
${js.map((f) => `/* ── ${f} ── */\n${read(f)}`).join("\n\n")}
</script>
`;

mkdirSync(resolve(root, "dist"), { recursive: true });
writeFileSync(resolve(root, "dist/monomoney.html"), out);
console.log(`dist/monomoney.html · ${(out.length / 1024).toFixed(1)} kB · ${css.length} css · ${js.length} js`);
