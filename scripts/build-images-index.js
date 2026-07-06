const fs = require("fs");
const path = require("path");

const root = process.cwd();
const imagesBase = path.join(root, "images", "trees", "shared", "personas");
const outPath = path.join(root, "data", "trees", "shared", "images-index.json");
const exts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif", ".bmp"]);

const bySlug = {};

if (fs.existsSync(imagesBase)) {
  const dirs = fs.readdirSync(imagesBase, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  dirs.forEach((entry) => {
    const slug = entry.name;
    const folder = path.join(imagesBase, slug);
    const files = fs.readdirSync(folder, { withFileTypes: true })
      .filter((item) => item.isFile())
      .map((item) => item.name)
      .filter((name) => exts.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
    bySlug[slug] = files;
  });
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ bySlug: bySlug }, null, 2) + "\n", "utf8");

console.log(`images-index actualizado: ${outPath} (${Object.keys(bySlug).length} slugs)`);
