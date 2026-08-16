/**
 * Anade una foto nueva a la ficha de una persona: genera sus derivados
 * (thumb/card/full en webp y jpg, via generateDerivatives de
 * optimize-images.mjs) en images/personas/<id>/ y escribe el bloque
 * heroImage o el elemento de gallery correspondiente en data/personas/<id>.json.
 *
 * El original nunca se sirve: acaba en images/originals/<id>/, igual que en
 * el flujo de npm run images.
 *
 * Es idempotente. Si los derivados ya estan en disco no se recodifican, y si
 * la ficha ya apunta a esa imagen no se duplica la entrada: se sale diciendo
 * que no hay nada que hacer. Con --force se rehacen los derivados igualmente.
 *
 *   node tools/add-photo.mjs <id> <ruta-a-la-foto> [opciones]
 *
 * Opciones:
 *   --hero              Sustituye heroImage en lugar de anadir a gallery
 *   --alt "texto"       Texto alternativo (por defecto: uno generico editable)
 *   --caption "texto"   Pie de foto (por defecto: vacio)
 *   --force             Recodifica los derivados aunque ya existan
 *   --dry-run           No escribe nada, muestra el JSON que anadiria
 *
 * Tras usarlo hace falta `npm run build` para regenerar data/tree-bundle.json.
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDerivatives } from "./optimize-images.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const USAGE =
  'Uso: node tools/add-photo.mjs <id> <ruta-a-la-foto> [--hero] [--alt "texto"] [--caption "texto"] [--force] [--dry-run]';

/** Opciones que consumen el argumento siguiente. */
const VALUE_FLAGS = new Set(["--alt", "--caption"]);
const BOOL_FLAGS = new Set(["--hero", "--force", "--dry-run", "--help"]);

/**
 * Pasada unica sobre argv: distingue opciones con valor de las booleanas, de
 * modo que un --alt "Antonio de Antonio" no se confunda nunca con el id ni con
 * la ruta de la foto.
 */
function parseArgs(argv) {
  const values = {};
  const positional = [];
  const unknown = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (VALUE_FLAGS.has(arg)) {
      const next = argv[i + 1];
      values[arg] = next && !next.startsWith("--") ? next : "";
      i += 1;
    } else if (BOOL_FLAGS.has(arg)) {
      values[arg] = true;
    } else if (arg.startsWith("--")) {
      unknown.push(arg);
    } else {
      positional.push(arg);
    }
  }
  return { values, positional, unknown };
}

function usageError(message) {
  console.error(`Error: ${message}\n${USAGE}`);
  process.exitCode = 1;
}

/** Misma clave que usa tools/validate-data.mjs para detectar repetidos. */
const imageKey = (image) => (image && (image.full || image.src)) || "";

async function main() {
  const { values, positional, unknown } = parseArgs(process.argv.slice(2));
  if (values["--help"]) {
    console.log(USAGE);
    return;
  }
  if (unknown.length) {
    usageError(`opcion desconocida: ${unknown.join(", ")}`);
    return;
  }

  const [personId, sourcePath] = positional;
  const altText = values["--alt"] || "";
  const captionText = values["--caption"] || "";

  if (!personId || !sourcePath) {
    usageError("faltan argumentos");
    return;
  }
  if (positional.length > 2) {
    usageError(`sobran argumentos: ${positional.slice(2).join(", ")}`);
    return;
  }
  if (!/^[a-z0-9-]+$/.test(personId)) {
    usageError(`id no valido: "${personId}" (debe cumplir ^[a-z0-9-]+$)`);
    return;
  }

  const personPath = path.join(ROOT, "data", "personas", `${personId}.json`);
  if (!existsSync(personPath)) {
    usageError(`no existe data/personas/${personId}.json`);
    return;
  }
  const absSource = path.resolve(sourcePath);
  if (!existsSync(absSource)) {
    usageError(`no existe el fichero de origen: ${sourcePath}`);
    return;
  }

  const dryRun = Boolean(values["--dry-run"]);
  const isHero = Boolean(values["--hero"]);
  const person = JSON.parse(await readFile(personPath, "utf8"));

  const entry = await generateDerivatives({
    slug: personId,
    buffer: await readFile(absSource),
    canonicalName: path.basename(absSource),
    dryRun,
    force: Boolean(values["--force"])
  });

  console.log(
    entry.reused
      ? "Derivados ya presentes, no se recodifica nada (--force para rehacerlos)"
      : `Derivados generados en images/personas/${personId}/`
  );

  const image = {
    src: entry.card_jpg,
    srcWebp: entry.card_webp,
    thumb: entry.thumb_jpg,
    thumbWebp: entry.thumb_webp,
    full: entry.full_jpg,
    fullWebp: entry.full_webp,
    width: entry.dimensions.card?.width ?? null,
    height: entry.dimensions.card?.height ?? null,
    alt: altText || `Fotografía de ${person.name}`,
    caption: captionText
  };

  const gallery = Array.isArray(person.gallery) ? person.gallery : [];
  const target = isHero ? person.heroImage : gallery.find((img) => imageKey(img) === imageKey(image));

  // Ya referenciada: se respeta lo que hay y solo se tocan los textos si el
  // usuario los ha pasado explicitamente. Anadirla otra vez haria que
  // validate-data fallase por imagen repetida en la galeria.
  if (target && imageKey(target) === imageKey(image)) {
    const updated = [];
    if (altText && target.alt !== altText) {
      target.alt = altText;
      updated.push("alt");
    }
    if (captionText && target.caption !== captionText) {
      target.caption = captionText;
      updated.push("caption");
    }
    if (!updated.length) {
      console.log(
        `La ficha ya referencia esta imagen en ${isHero ? "heroImage" : "gallery"}. Nada que hacer.`
      );
      return;
    }
    if (!dryRun) {
      await writeFile(personPath, `${JSON.stringify(person, null, 2)}\n`, "utf8");
    }
    console.log(`Actualizado ${updated.join(" y ")} en data/personas/${personId}.json`);
    return;
  }

  if (isHero) {
    person.heroImage = image;
  } else {
    person.gallery = gallery;
    gallery.push(image);
  }

  if (dryRun) {
    console.log(`\nSe anadiria a ${isHero ? "heroImage" : "gallery"}:`);
    console.log(JSON.stringify(image, null, 2));
    console.log("\n(--dry-run: no se ha escrito nada)");
    return;
  }

  await writeFile(personPath, `${JSON.stringify(person, null, 2)}\n`, "utf8");
  console.log(`${isHero ? "heroImage" : "gallery"} actualizado en data/personas/${personId}.json`);
  console.log(`Original archivado en ${entry.original}`);
  console.log("\nRecuerda: npm run build (y revisa alt/caption si no los pasaste por flag)");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
