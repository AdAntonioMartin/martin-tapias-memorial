/**
 * Migracion unica de la capa de datos.
 *
 * Problemas que resuelve, todos medidos sobre el estado anterior:
 *
 *  - Los tres "arboles" eran dos ficheros, y las 55 uniones de uno eran un
 *    subconjunto estricto de las 59 del otro: en realidad habia un solo grafo
 *    copiado cuatro veces. Pasa a haber un data/unions.json y los arboles se
 *    vuelven vistas con una persona raiz.
 *  - 80 de 161 identificadores contenian interrogantes literales, usados como
 *    marcador de apellido desconocido, y se mostraban en pantalla y viajaban
 *    en la URL. Se sustituyen por identificadores ASCII estables.
 *  - born y died estaban vacios en las 161 fichas; las fechas vivian como
 *    texto libre dentro de facts, indexadas por una etiqueta en castellano.
 *  - 604 de 671 facts tenian value vacio y se renderizaban igual.
 *  - family duplicaba el parentesco que ya estaba en las uniones y no lo leia
 *    nadie; notes, sources y biography estaban vacios en las 161.
 *  - Las galerias apuntaban a las cuatro copias de cada foto.
 *
 *   node tools/migrate-data.mjs [--dry-run]
 */

import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY_RUN = process.argv.includes("--dry-run");

/** Persona por la que se abre cada vista familiar. */
const TREE_ROOTS = {
  martin: "castor-martin-bravo",
  deantonio: "inocenta-de-la-calle",
  "teresa-castano-pineda": "teresa-castano-pineda"
};

/** Vocabulario unico de facts. Sustituye a los dos dialectos anteriores. */
const FACT_LABELS = {
  nacimiento: "Nacimiento",
  fallecimiento: "Fallecimiento",
  lugar: "Lugar",
  ocupacion: "Ocupación",
  "nombre completo": "Nombre completo",
  padres: "Padres",
  "lugar de nacimiento": "Lugar de nacimiento",
  "lugar de fallecimiento": "Lugar de fallecimiento",
  hora: "Hora",
  edad: "Edad",
  motivo: "Motivo"
};

const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join("/");
const readJson = async (relPath) => JSON.parse(await readFile(path.join(ROOT, relPath), "utf8"));

async function writeJson(relPath, value) {
  if (DRY_RUN) {
    return;
  }
  const abs = path.join(ROOT, relPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function stripDiacritics(value) {
  return String(value).normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Identificador estable: ASCII, minusculas, sin interrogantes ni tildes. */
function toId(value) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Limpia el nombre visible. "Nicolasa ????? ?????" -> "Nicolasa", marcando
 * que se desconocen los apellidos para que la interfaz lo diga con palabras
 * en lugar de pintar interrogantes.
 */
function cleanName(rawName, fallbackId) {
  const cleaned = String(rawName || "")
    .replace(/\?+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned) {
    return { name: cleaned, unknownParts: /\?/.test(String(rawName || "")) };
  }
  const fromId = String(fallbackId || "")
    .replace(/\?+/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    name: fromId ? fromId.replace(/\b\w/g, (c) => c.toUpperCase()) : "Persona sin identificar",
    unknownParts: true
  };
}

/** "13/06/1923" -> "1923-06-13"; "1890" -> "1890"; texto libre -> "". */
function toIsoDate(value) {
  const text = String(value || "").trim();
  const full = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (full) {
    const [, d, m, y] = full;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const yearOnly = text.match(/^(\d{4})$/);
  return yearOnly ? yearOnly[1] : "";
}

function normalizeFacts(facts) {
  const seen = new Set();
  return (Array.isArray(facts) ? facts : [])
    .filter((fact) => fact && fact.label && String(fact.value || "").trim())
    .map((fact) => ({
      label: FACT_LABELS[stripDiacritics(fact.label).toLowerCase()] || fact.label,
      value: String(fact.value).trim()
    }))
    .filter((fact) => {
      if (seen.has(fact.label)) {
        return false;
      }
      seen.add(fact.label);
      return true;
    });
}

function factValue(facts, label) {
  const target = stripDiacritics(label).toLowerCase();
  const match = facts.find((fact) => stripDiacritics(fact.label).toLowerCase() === target);
  return match ? match.value : "";
}

/** Sustituye una ruta antigua por sus derivados; conserva las que no cambian. */
function mapImage(image, manifest, personName) {
  if (!image || !image.src) {
    return null;
  }
  const entry = manifest[image.src];
  const alt = String(image.alt || "").trim() || `Fotografía de ${personName}`;
  const caption = String(image.caption || "").trim();

  if (!entry) {
    return { src: image.src, alt, caption };
  }
  return {
    src: entry.card_jpg,
    srcWebp: entry.card_webp,
    thumb: entry.thumb_jpg,
    thumbWebp: entry.thumb_webp,
    full: entry.full_jpg,
    fullWebp: entry.full_webp,
    width: entry.dimensions?.card?.width || null,
    height: entry.dimensions?.card?.height || null,
    alt,
    caption,
    __key: entry.original
  };
}

async function collectPersonFiles() {
  const files = [];
  const treesDir = path.join(ROOT, "data", "trees");
  for (const entry of await readdir(treesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const personasDir = path.join(treesDir, entry.name, "personas");
    if (!existsSync(personasDir)) {
      continue;
    }
    for (const file of await readdir(personasDir)) {
      if (file.endsWith(".json")) {
        files.push(rel(path.join(personasDir, file)));
      }
    }
  }
  return files.sort();
}

async function main() {
  const manifest = existsSync(path.join(ROOT, "images/manifest.json"))
    ? await readJson("images/manifest.json")
    : {};

  const personFiles = await collectPersonFiles();
  const records = [];
  for (const file of personFiles) {
    records.push({ file, data: await readJson(file) });
  }

  // --- 1. identificadores nuevos, estables y sin colisiones ---
  const idMap = new Map();
  const usedIds = new Set();
  const stats = { renamed: 0, unknownNames: 0, datesRecovered: 0, factsDropped: 0, galleryDropped: 0 };

  for (const { data } of records) {
    const oldId = data.id;
    const { name, unknownParts } = cleanName(data.name, oldId);
    let candidate = toId(oldId.replace(/\?+/g, "")) || toId(name) || "persona";
    candidate = candidate.replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");

    let unique = candidate;
    let counter = 2;
    while (usedIds.has(unique)) {
      unique = `${candidate}-${counter}`;
      counter += 1;
    }
    usedIds.add(unique);
    idMap.set(oldId, unique);
    if (unique !== oldId) {
      stats.renamed += 1;
    }
    if (unknownParts) {
      stats.unknownNames += 1;
    }
  }

  // --- 2. reescritura de cada ficha ---
  const index = {};
  for (const { data } of records) {
    const newId = idMap.get(data.id);
    const { name, unknownParts } = cleanName(data.name, data.id);
    const facts = normalizeFacts(data.facts);
    stats.factsDropped += (data.facts || []).length - facts.length;

    const born = toIsoDate(factValue(facts, "Nacimiento"));
    const died = toIsoDate(factValue(facts, "Fallecimiento"));
    if (born || died) {
      stats.datesRecovered += 1;
    }

    const hero = mapImage(data.heroImage, manifest, name);
    const gallerySeen = new Set();
    const gallery = [];
    for (const image of Array.isArray(data.gallery) ? data.gallery : []) {
      const mapped = mapImage(image, manifest, name);
      if (!mapped) {
        continue;
      }
      const key = mapped.__key || mapped.src;
      if (gallerySeen.has(key)) {
        stats.galleryDropped += 1;
        continue;
      }
      gallerySeen.add(key);
      delete mapped.__key;
      gallery.push(mapped);
    }
    if (hero) {
      delete hero.__key;
    }

    const migrated = {
      id: newId,
      name,
      gender: ["male", "female"].includes(data.gender) ? data.gender : "unknown",
      born,
      died,
      summary: String(data.summary || "").trim(),
      heroImage: hero,
      gallery,
      facts
    };
    if (unknownParts) {
      // La interfaz usa esto para decir "apellidos desconocidos" con palabras.
      migrated.unknownNameParts = true;
    }
    const notes = String(data.notes || "").trim();
    if (notes) {
      migrated.notes = notes;
    }
    if (Array.isArray(data.sources) && data.sources.length) {
      migrated.sources = data.sources;
    }
    if (Array.isArray(data.biography) && data.biography.length) {
      migrated.biography = data.biography;
    }

    const newPath = `data/personas/${newId}.json`;
    await writeJson(newPath, migrated);
    index[newId] = newPath;
  }

  // --- 3. uniones: un solo fichero con el grafo completo ---
  const unionSets = [
    "data/trees/teresa-castano-pineda/arbol.json",
    "data/trees/deantonio/arbol.json",
    "data/trees/martin/arbol.json"
  ].filter((p) => existsSync(path.join(ROOT, p)));

  const unionsById = new Map();
  for (const file of unionSets) {
    for (const union of (await readJson(file)).unions || []) {
      if (!union || !union.id || unionsById.has(union.id)) {
        continue;
      }
      const mapId = (id) => idMap.get(id) || toId(String(id).replace(/\?+/g, "")) || null;
      const partners = (union.partners || []).map(mapId).filter(Boolean);
      const children = (union.children || []).map(mapId).filter(Boolean);
      const entry = { id: union.id, partners, children, type: union.type || "married" };
      if (union.married) {
        entry.married = union.married;
      }
      unionsById.set(union.id, entry);
    }
  }
  const unions = [...unionsById.values()].sort((a, b) => a.id.localeCompare(b.id));

  await writeJson("data/unions.json", { unions });
  await writeJson("data/personas-index.json", { byId: Object.fromEntries(Object.entries(index).sort()) });

  // --- 4. los arboles pasan a ser vistas ---
  const registry = await readJson("data/trees/index.json");
  const trees = registry.trees.map((tree) => ({
    key: tree.key,
    title: tree.title,
    rootPersonId: idMap.get(TREE_ROOTS[tree.key]) || TREE_ROOTS[tree.key] || ""
  }));
  await writeJson("data/trees/index.json", { defaultTree: registry.defaultTree, trees });

  // --- 5. limpieza de los ficheros que quedan sin uso ---
  if (!DRY_RUN) {
    for (const stale of [
      "data/arbol.json",
      "data/trees/martin",
      "data/trees/deantonio",
      "data/trees/teresa-castano-pineda"
    ]) {
      await rm(path.join(ROOT, stale), { recursive: true, force: true });
    }
  }

  console.log(`Fichas migradas:            ${records.length}`);
  console.log(`Identificadores renombrados:${String(stats.renamed).padStart(5)}`);
  console.log(`Nombres con partes desconocidas: ${stats.unknownNames}`);
  console.log(`Fichas con fecha estructurada:   ${stats.datesRecovered}`);
  console.log(`Facts vacios descartados:   ${stats.factsDropped}`);
  console.log(`Imagenes duplicadas quitadas de galerias: ${stats.galleryDropped}`);
  console.log(`Uniones en data/unions.json:${String(unions.length).padStart(5)}`);
  if (DRY_RUN) {
    console.log("\n(--dry-run: no se ha escrito nada)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
