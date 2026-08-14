/**
 * Valida la coherencia de data/ contra el disco.
 *
 * Comprueba que cada persona referenciada en las uniones se pueda resolver, que
 * las rutas del indice existan, que los identificadores sean estables y que las
 * imagenes citadas esten realmente ahi. Sale con codigo 1 si hay errores.
 *
 *   node tools/validate-data.mjs
 *   node tools/validate-data.mjs --quiet   (solo el resumen)
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const QUIET = process.argv.includes("--quiet");

const ID_PATTERN = /^[a-z0-9-]+$/;
const ALLOWED_FACT_LABELS = new Set([
  "Nacimiento",
  "Fallecimiento",
  "Lugar",
  "Ocupacion",
  "Nombre completo",
  "Padres",
  "Lugar de nacimiento",
  "Lugar de fallecimiento",
  "Hora",
  "Edad",
  "Motivo"
]);

const errors = [];
const warnings = [];

function fail(scope, message) {
  errors.push({ scope, message });
}

function warn(scope, message) {
  warnings.push({ scope, message });
}

async function readJson(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!existsSync(abs)) {
    return null;
  }
  try {
    return JSON.parse(await readFile(abs, "utf8"));
  } catch (err) {
    fail(relPath, `JSON mal formado: ${err.message}`);
    return null;
  }
}

function fileExists(relPath) {
  return existsSync(path.join(ROOT, relPath));
}

async function loadIndex(relPath) {
  const payload = await readJson(relPath);
  if (!payload) {
    fail(relPath, "no existe o no se pudo leer");
    return {};
  }
  return payload.byId && typeof payload.byId === "object" ? payload.byId : {};
}

async function main() {
  const registry = await readJson("data/trees/index.json");
  if (!registry) {
    fail("data/trees/index.json", "el registro de arboles no existe");
    return report();
  }

  const rootIndex = await loadIndex("data/personas-index.json");

  // --- indice raiz: rutas, identificadores y coherencia con el fichero ---
  const seenPaths = new Map();
  for (const [id, relPath] of Object.entries(rootIndex)) {
    if (!ID_PATTERN.test(id)) {
      fail("data/personas-index.json", `identificador no estable: "${id}"`);
    }
    if (!fileExists(relPath)) {
      fail("data/personas-index.json", `"${id}" apunta a un fichero inexistente: ${relPath}`);
      continue;
    }
    if (seenPaths.has(relPath)) {
      warn("data/personas-index.json", `${relPath} esta indexado por "${seenPaths.get(relPath)}" y "${id}"`);
    } else {
      seenPaths.set(relPath, id);
    }

    const record = await readJson(relPath);
    if (!record) {
      continue;
    }
    if (record.id !== id) {
      fail(relPath, `el campo id ("${record.id}") no coincide con la clave del indice ("${id}")`);
    }
    validateRecord(relPath, record);
  }

  // --- cada arbol: uniones resolubles ---
  const trees = Array.isArray(registry.trees) ? registry.trees : [];
  if (!trees.length) {
    fail("data/trees/index.json", "no declara ningun arbol");
  }

  const unionHashes = new Map();
  for (const tree of trees) {
    const scope = `arbol "${tree.key}"`;
    const treeIndex = await loadIndex(tree.peopleIndex);
    const byId = { ...rootIndex, ...treeIndex };

    const config = await readJson(tree.treeConfig);
    if (!config) {
      fail(scope, `no se pudo leer ${tree.treeConfig}`);
      continue;
    }

    const raw = JSON.stringify(config.unions || []);
    if (unionHashes.has(raw)) {
      fail(scope, `sus uniones son identicas a las de "${unionHashes.get(raw)}": son el mismo arbol`);
    } else {
      unionHashes.set(raw, tree.key);
    }

    const unions = Array.isArray(config.unions) ? config.unions : [];
    const unionIds = new Set();
    for (const union of unions) {
      if (!union || !union.id) {
        fail(scope, "hay una union sin id");
        continue;
      }
      if (unionIds.has(union.id)) {
        fail(scope, `union duplicada: ${union.id}`);
      }
      unionIds.add(union.id);

      const partners = Array.isArray(union.partners) ? union.partners : [];
      const children = Array.isArray(union.children) ? union.children : [];
      if (!partners.length) {
        fail(scope, `la union ${union.id} no tiene ningun miembro`);
      }
      for (const personId of [...partners, ...children]) {
        if (!personId) {
          fail(scope, `la union ${union.id} contiene un identificador vacio`);
        } else if (!byId[personId]) {
          fail(scope, `la union ${union.id} referencia a "${personId}", que no esta en ningun indice`);
        }
      }
    }
  }

  return report();
}

function validateRecord(relPath, record) {
  if (record.slug && record.id && record.slug !== record.id) {
    warn(relPath, `slug ("${record.slug}") e id ("${record.id}") divergen`);
  }

  const images = [];
  if (record.heroImage && record.heroImage.src) {
    images.push(record.heroImage.src);
  }
  if (Array.isArray(record.gallery)) {
    for (const image of record.gallery) {
      if (image && image.src) {
        images.push(image.src);
      }
    }
  }
  const seenImages = new Set();
  for (const src of images) {
    if (!fileExists(src)) {
      fail(relPath, `imagen inexistente: ${src}`);
    }
    if (seenImages.has(src)) {
      warn(relPath, `imagen repetida en la galeria: ${src}`);
    }
    seenImages.add(src);
  }

  if (Array.isArray(record.facts)) {
    for (const fact of record.facts) {
      if (fact && fact.label && !ALLOWED_FACT_LABELS.has(fact.label)) {
        fail(relPath, `etiqueta de fact fuera del vocabulario: "${fact.label}"`);
      }
    }
  }
}

function report() {
  const group = (list) => {
    const byScope = new Map();
    for (const item of list) {
      if (!byScope.has(item.scope)) {
        byScope.set(item.scope, []);
      }
      byScope.get(item.scope).push(item.message);
    }
    return byScope;
  };

  if (!QUIET) {
    for (const [scope, messages] of group(errors)) {
      console.error(`\n  ${scope}`);
      for (const message of messages) {
        console.error(`    ERROR  ${message}`);
      }
    }
    for (const [scope, messages] of group(warnings)) {
      console.warn(`\n  ${scope}`);
      for (const message of messages) {
        console.warn(`    aviso  ${message}`);
      }
    }
  }

  console.log(`\n${errors.length} errores, ${warnings.length} avisos.`);
  process.exitCode = errors.length ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
