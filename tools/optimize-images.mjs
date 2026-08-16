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
 *
 * Es una pasada masiva sobre carpetas con fotos recien soltadas: no toca los
 * JSON de las personas. Para anadir una foto suelta y que ademas quede escrita
 * en la ficha, usar tools/add-photo.mjs, que reutiliza generateDerivatives.
 *
 * Se puede repetir sin dano: los ficheros que ya son derivados (-thumb, -card,
 * -full) se ignoran como fuente, y generateDerivatives no recodifica lo que ya
 * esta en disco.
 *
 *   node tools/optimize-images.mjs [--dry-run]
 */

import { createHash } from "node:crypto";
import { readFile, writeFile, readdir, mkdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { siteRoot } from "./lib/site-config.mjs";

const ROOT = siteRoot();
const SERVED_DIR = path.join(ROOT, "images", "personas");
const ORIGINALS_DIR = path.join(ROOT, "images", "originals");
const DRY_RUN = process.argv.includes("--dry-run");

const SIZES = [
  { name: "thumb", width: 96 },
  { name: "card", width: 640 },
  { name: "full", width: 1600 }
];
const FORMATS = [
  ["webp", { quality: 82 }],
  ["jpg", { quality: 82, mozjpeg: true }]
];
const RASTER = /\.(jpe?g|png|webp)$/i;
/**
 * Salidas de una pasada anterior. Hay que excluirlas explicitamente: tras la
 * primera ejecucion la carpeta servida solo contiene derivados, y como todos
 * casan con RASTER una segunda pasada los tomaria por fuentes y generaria
 * -card-thumb, -thumb-full y demas combinaciones.
 */
const DERIVED = new RegExp(`-(${SIZES.map((size) => size.name).join("|")})\\.(webp|jpg)$`, "i");

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

/**
 * Rutas de salida de una imagen, sin tocar el disco. Se calcula aparte para
 * poder preguntar si el trabajo ya esta hecho antes de rehacerlo.
 */
function planDerivatives(slug, canonicalName) {
  const baseSlug = toSlug(canonicalName);
  const folder = path.join(SERVED_DIR, slug);
  const outputs = [];
  for (const size of SIZES) {
    for (const [format, options] of FORMATS) {
      const outName = `${baseSlug}-${size.name}.${format}`;
      outputs.push({
        size,
        format,
        options,
        key: `${size.name}_${format}`,
        outPath: path.join(folder, outName),
        rel: `images/personas/${slug}/${outName}`
      });
    }
  }
  return { baseSlug, folder, outputs };
}

/**
 * Genera los seis derivados (3 tamanos x 2 formatos) de una imagen ya cargada
 * en memoria y guarda el original bajo images/originals/<slug>/. Comun al
 * flujo de deduplicacion masiva (processFolder) y a tools/add-photo.mjs, que
 * anade una sola foto nueva a una persona.
 *
 * Si los seis derivados y el original archivado ya estan en disco no se
 * recodifica nada: las medidas se leen de los ficheros existentes y se
 * devuelve reused: true. Con force: true se rehace de todos modos.
 */
async function generateDerivatives({ slug, buffer, canonicalName, stats, dryRun = DRY_RUN, force = false }) {
  const ext = path.extname(canonicalName).toLowerCase().replace(".jpeg", ".jpg");
  const { baseSlug, folder, outputs } = planDerivatives(slug, canonicalName);
  const originalName = `${baseSlug}${ext}`;
  const originalRel = `images/originals/${slug}/${originalName}`;
  const originalPath = path.join(ORIGINALS_DIR, slug, originalName);

  const derived = {};
  for (const out of outputs) {
    derived[out.key] = out.rel;
  }
  const dimensions = {};

  const alreadyDone = !force && existsSync(originalPath) && outputs.every((out) => existsSync(out.outPath));
  if (alreadyDone) {
    for (const out of outputs) {
      if (!dimensions[out.size.name]) {
        const meta = await sharp(out.outPath).metadata();
        dimensions[out.size.name] = { width: meta.width, height: meta.height };
      }
    }
    return { ...derived, original: originalRel, dimensions, reused: true };
  }

  const meta = await sharp(buffer).metadata();
  if (!dryRun) {
    await mkdir(folder, { recursive: true });
  }

  for (const out of outputs) {
    const width = Math.min(out.size.width, meta.width || out.size.width);
    const pipeline = sharp(buffer)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .toFormat(out.format === "jpg" ? "jpeg" : "webp", out.options);

    // En dry-run se codifica igualmente a memoria: es la unica forma de saber
    // las medidas reales, y son las que acaban en el JSON de la persona.
    if (dryRun) {
      const { info } = await pipeline.toBuffer({ resolveWithObject: true });
      dimensions[out.size.name] = { width: info.width, height: info.height };
      continue;
    }

    const info = await pipeline.toFile(out.outPath);
    dimensions[out.size.name] = { width: info.width, height: info.height };
    if (stats) {
      stats.generatedBytes += (await stat(out.outPath)).size;
    }
  }

  if (!dryRun) {
    await mkdir(path.join(ORIGINALS_DIR, slug), { recursive: true });
    await writeFile(originalPath, buffer);
  }

  return { ...derived, original: originalRel, dimensions, reused: false };
}

async function processFolder(slug, stats) {
  const folder = path.join(SERVED_DIR, slug);
  const entries = await readdir(folder);
  const files = entries.filter((name) => RASTER.test(name) && !DERIVED.test(name));
  stats.alreadyDerived += entries.filter((name) => DERIVED.test(name)).length;
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

  for (const group of byHash.values()) {
    const canonical = pickCanonicalName(group.sources);

    // Se lee una sola vez a memoria: en Windows, sharp mantiene abierto el
    // fichero de origen y el rename posterior falla con EBUSY.
    const buffer = await readFile(path.join(folder, canonical));
    await generateDerivatives({ slug, buffer, canonicalName: canonical, stats });

    if (!DRY_RUN) {
      for (const source of group.sources) {
        const stale = path.join(folder, source);
        if (existsSync(stale)) {
          await rm(stale, { force: true });
        }
      }
    }

    stats.uniqueImages += 1;
  }
}

async function main() {
  if (!existsSync(SERVED_DIR)) {
    throw new Error(`No existe ${SERVED_DIR}`);
  }

  const stats = {
    totalBytes: 0,
    duplicateBytes: 0,
    generatedBytes: 0,
    uniqueImages: 0,
    alreadyDerived: 0
  };

  for (const slug of await collectPersonFolders()) {
    await processFolder(slug, stats);
  }

  console.log(`Fuentes nuevas procesadas: ${stats.uniqueImages}`);
  console.log(`Derivados ya existentes:   ${stats.alreadyDerived} (sin tocar)`);
  console.log(`Tamano original:           ${formatMB(stats.totalBytes)}`);
  console.log(`Duplicado eliminado:       ${formatMB(stats.duplicateBytes)}`);
  console.log(`Derivados generados:       ${formatMB(stats.generatedBytes)}`);
  if (DRY_RUN) {
    console.log("\n(--dry-run: no se ha escrito nada)");
  }
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

export { generateDerivatives, toSlug, SERVED_DIR, ORIGINALS_DIR };
