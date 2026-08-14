/**
 * Deduplica y optimiza las fotografias del memorial.
 *
 * Situacion de partida: 101 ficheros y 276 MB, de los que solo 27 ficheros y
 * 69 MB eran unicos. Cada foto estaba guardada cuatro veces (X, X-2, X-3,
 * X-2-2) y las cuatro copias estaban referenciadas en los JSON, asi que la
 * galeria mostraba la misma imagen repetida y una sola ficha llegaba a pesar
 * 77 MB. Ademas se usaban PNG de 3000x4016 como avatares de 44 px.
 *
 * Que hace:
 *   1. Agrupa por hash SHA-1 y se queda con un original por imagen.
 *   2. Mueve ese original a images/originals/<slug>/ (archivo, no se sirve).
 *   3. Genera en images/personas/<slug>/ tres tamanos en WebP y JPEG:
 *        thumb 96px (avatares del arbol), card 640px (galeria), full 1600px.
 *   4. Escribe images/manifest.json con el mapa original -> derivados, que
 *      consume tools/migrate-data.mjs para reescribir las fichas.
 *
 *   node tools/optimize-images.mjs [--dry-run]
 */

import { createHash } from "node:crypto";
import { readFile, writeFile, readdir, mkdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVED_DIR = path.join(ROOT, "images", "personas");
const ORIGINALS_DIR = path.join(ROOT, "images", "originals");
const MANIFEST = path.join(ROOT, "images", "manifest.json");
const DRY_RUN = process.argv.includes("--dry-run");

const SIZES = [
  { name: "thumb", width: 96 },
  { name: "card", width: 640 },
  { name: "full", width: 1600 }
];
const RASTER = /\.(jpe?g|png|webp)$/i;

/** Nombre de fichero seguro para URL: sin espacios, sin tildes, sin mayusculas. */
function toSlug(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/**
 * De un grupo de ficheros identicos, el nombre bueno es el mas corto: la
 * duplicacion anadia sufijos (-2, -3, -2-2) sobre el original, asi que el
 * original siempre es el nombre mas corto del grupo. No vale con recortar los
 * digitos finales, porque nombres reales como IMG_4010 acabarian en "img".
 */
function pickCanonicalName(names) {
  return [...names].sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
}

function formatMB(bytes) {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

async function hashFile(filePath) {
  return createHash("sha1")
    .update(await readFile(filePath))
    .digest("hex");
}

async function collectPersonFolders() {
  const entries = await readdir(SERVED_DIR, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

async function processFolder(slug, manifest, stats) {
  const folder = path.join(SERVED_DIR, slug);
  const files = (await readdir(folder)).filter((name) => RASTER.test(name));
  if (!files.length) {
    return;
  }

  /** hash -> { keptOriginal, sources[] } */
  const byHash = new Map();
  for (const name of files.sort()) {
    const filePath = path.join(folder, name);
    const hash = await hashFile(filePath);
    const size = (await stat(filePath)).size;
    stats.totalBytes += size;

    if (!byHash.has(hash)) {
      byHash.set(hash, { sources: [] });
    } else {
      stats.duplicateBytes += size;
    }
    byHash.get(hash).sources.push(name);
  }

  await mkdir(path.join(ORIGINALS_DIR, slug), { recursive: true });

  for (const group of byHash.values()) {
    const canonical = pickCanonicalName(group.sources);
    const ext = path.extname(canonical).toLowerCase().replace(".jpeg", ".jpg");
    const baseSlug = toSlug(canonical);
    const originalName = `${baseSlug}${ext}`;

    // Se lee una sola vez a memoria: en Windows, sharp mantiene abierto el
    // fichero de origen y el rename posterior falla con EBUSY.
    const buffer = await readFile(path.join(folder, canonical));
    const meta = await sharp(buffer).metadata();

    const derived = {};
    const dimensions = {};
    for (const size of SIZES) {
      const width = Math.min(size.width, meta.width || size.width);
      for (const [format, options] of [
        ["webp", { quality: 82 }],
        ["jpg", { quality: 82, mozjpeg: true }]
      ]) {
        const outName = `${baseSlug}-${size.name}.${format}`;
        const outPath = path.join(folder, outName);
        if (!DRY_RUN) {
          const info = await sharp(buffer)
            .rotate()
            .resize({ width, withoutEnlargement: true })
            .toFormat(format === "jpg" ? "jpeg" : "webp", options)
            .toFile(outPath);
          stats.generatedBytes += (await stat(outPath)).size;
          dimensions[size.name] = { width: info.width, height: info.height };
        }
        derived[`${size.name}_${format}`] = `images/personas/${slug}/${outName}`;
      }
    }

    if (!DRY_RUN) {
      await writeFile(path.join(ORIGINALS_DIR, slug, originalName), buffer);
      for (const source of group.sources) {
        const stale = path.join(folder, source);
        if (existsSync(stale)) {
          await rm(stale, { force: true });
        }
      }
    }

    // Todas las rutas antiguas del grupo apuntan al mismo juego de derivados.
    for (const source of group.sources) {
      manifest[`images/personas/${slug}/${source}`] = {
        ...derived,
        original: `images/originals/${slug}/${originalName}`,
        dimensions
      };
    }
    stats.uniqueImages += 1;
  }
}

async function main() {
  if (!existsSync(SERVED_DIR)) {
    throw new Error(`No existe ${SERVED_DIR}`);
  }

  const manifest = {};
  const stats = { totalBytes: 0, duplicateBytes: 0, generatedBytes: 0, uniqueImages: 0 };

  for (const slug of await collectPersonFolders()) {
    await processFolder(slug, manifest, stats);
  }

  if (!DRY_RUN) {
    await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  console.log(`Imagenes unicas:      ${stats.uniqueImages}`);
  console.log(`Rutas mapeadas:       ${Object.keys(manifest).length}`);
  console.log(`Tamano original:      ${formatMB(stats.totalBytes)}`);
  console.log(`Duplicado eliminado:  ${formatMB(stats.duplicateBytes)}`);
  console.log(`Derivados generados:  ${formatMB(stats.generatedBytes)}`);
  if (DRY_RUN) {
    console.log("\n(--dry-run: no se ha escrito nada)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
