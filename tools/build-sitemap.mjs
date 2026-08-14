/**
 * Genera sitemap.xml y robots.txt.
 *
 * El sitio no tenia ninguno de los dos, y todo su contenido se inyecta por
 * JavaScript, asi que un buscador no veia nada. Para un memorial que la gente
 * busca escribiendo el nombre de un familiar, esto importa mas de lo habitual.
 *
 * Las fichas van con ?id=, que muchos rastreadores tratan como duplicado, asi
 * que persona.html lleva `noindex, follow`: se rastrean los enlaces pero no se
 * indexa la plantilla vacia. El sitemap lista solo las paginas reales.
 *
 *   node tools/build-sitemap.mjs [https://dominio.example]
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_BASE = "https://adantoniomartin.github.io/martin-tapias-memorial";
const BASE = (process.argv[2] || DEFAULT_BASE).replace(/\/+$/, "");

async function main() {
  const registry = JSON.parse(await readFile(path.join(ROOT, "data/trees/index.json"), "utf8"));
  const today = new Date().toISOString().slice(0, 10);

  const urls = [
    { loc: `${BASE}/index.html`, priority: "1.0" },
    { loc: `${BASE}/arbol.html`, priority: "0.8" },
    ...registry.trees.map((tree) => ({
      loc: `${BASE}/arbol.html?tree=${encodeURIComponent(tree.key)}`,
      priority: "0.6"
    }))
  ];

  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map(
        (url) =>
          `  <url>\n    <loc>${url.loc.replace(/&/g, "&amp;")}</loc>\n` +
          `    <lastmod>${today}</lastmod>\n    <priority>${url.priority}</priority>\n  </url>\n`
      )
      .join("") +
    "</urlset>\n";

  const robots = `User-agent: *\nAllow: /\nDisallow: /images/originals/\n\nSitemap: ${BASE}/sitemap.xml\n`;

  await writeFile(path.join(ROOT, "sitemap.xml"), sitemap, "utf8");
  await writeFile(path.join(ROOT, "robots.txt"), robots, "utf8");
  console.log(`sitemap.xml: ${urls.length} URLs con base ${BASE}`);
  if (BASE === DEFAULT_BASE) {
    console.log("Si el sitio va a otro dominio: node tools/build-sitemap.mjs https://tu-dominio");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
