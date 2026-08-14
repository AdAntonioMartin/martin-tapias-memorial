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
const ISO_DATE = /^\d{4}(-\d{2}-\d{2})?$/;
const ALLOWED_FACT_LABELS = new Set([
  "Nacimiento",
  "Fallecimiento",
  "Lugar",
  "Ocupación",
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

const fail = (scope, message) => errors.push({ scope, message });
const warn = (scope, message) => warnings.push({ scope, message });
const fileExists = (relPath) => existsSync(path.join(ROOT, relPath));

async function readJson(relPath) {
  if (!fileExists(relPath)) {
    fail(relPath, "no existe");
    return null;
  }
  try {
    return JSON.parse(await readFile(path.join(ROOT, relPath), "utf8"));
  } catch (err) {
    fail(relPath, `JSON mal formado: ${err.message}`);
    return null;
  }
}

function validateImage(relPath, image, label) {
  if (!image || !image.src) {
    return;
  }
  for (const key of ["src", "srcWebp", "thumb", "thumbWebp", "full", "fullWebp"]) {
    if (image[key] && !fileExists(image[key])) {
      fail(relPath, `${label}: fichero inexistente en ${key}: ${image[key]}`);
    }
  }
  if (!image.alt) {
    warn(relPath, `${label}: sin texto alternativo`);
  }
}

function validateRecord(relPath, record, id) {
  if (record.id !== id) {
    fail(relPath, `el campo id ("${record.id}") no coincide con la clave del indice ("${id}")`);
  }
  if (!record.name || /\?/.test(record.name)) {
    fail(relPath, `nombre no presentable: "${record.name}"`);
  }
  if (!["male", "female", "unknown"].includes(record.gender)) {
    fail(relPath, `genero no valido: "${record.gender}"`);
  }
  for (const field of ["born", "died"]) {
    if (record[field] && !ISO_DATE.test(record[field])) {
      fail(relPath, `${field} no esta en formato ISO: "${record[field]}"`);
    }
  }

  validateImage(relPath, record.heroImage, "heroImage");
  const seen = new Set();
  (Array.isArray(record.gallery) ? record.gallery : []).forEach((image, index) => {
    validateImage(relPath, image, `gallery[${index}]`);
    const key = image && (image.full || image.src);
    if (key && seen.has(key)) {
      fail(relPath, `imagen repetida en la galeria: ${key}`);
    }
    seen.add(key);
  });

  (Array.isArray(record.facts) ? record.facts : []).forEach((fact) => {
    if (!fact || !fact.label) {
      return;
    }
    if (!ALLOWED_FACT_LABELS.has(fact.label)) {
      fail(relPath, `etiqueta de fact fuera del vocabulario: "${fact.label}"`);
    }
    if (!String(fact.value || "").trim()) {
      fail(relPath, `fact sin valor: "${fact.label}"`);
    }
  });

  for (const dead of ["family", "slug", "subtitle"]) {
    if (dead in record) {
      warn(relPath, `campo obsoleto que deberia haberse migrado: ${dead}`);
    }
  }
}

async function main() {
  const index = await readJson("data/personas-index.json");
  const byId = index && index.byId ? index.byId : {};
  if (!Object.keys(byId).length) {
    fail("data/personas-index.json", "el indice esta vacio");
  }

  for (const [id, relPath] of Object.entries(byId)) {
    if (!ID_PATTERN.test(id)) {
      fail("data/personas-index.json", `identificador no estable: "${id}"`);
    }
    const record = await readJson(relPath);
    if (record) {
      validateRecord(relPath, record, id);
    }
  }

  const unionsPayload = await readJson("data/unions.json");
  const unions = unionsPayload && Array.isArray(unionsPayload.unions) ? unionsPayload.unions : [];
  if (!unions.length) {
    fail("data/unions.json", "no hay ninguna union");
  }

  const unionIds = new Set();
  const referenced = new Set();
  for (const union of unions) {
    if (!union || !union.id) {
      fail("data/unions.json", "hay una union sin id");
      continue;
    }
    if (unionIds.has(union.id)) {
      fail("data/unions.json", `union duplicada: ${union.id}`);
    }
    unionIds.add(union.id);

    const partners = Array.isArray(union.partners) ? union.partners : [];
    const children = Array.isArray(union.children) ? union.children : [];
    if (!partners.length) {
      fail("data/unions.json", `la union ${union.id} no tiene ningun miembro`);
    } else if (partners.length === 1) {
      warn("data/unions.json", `la union ${union.id} solo tiene un miembro`);
    }
    for (const personId of [...partners, ...children]) {
      referenced.add(personId);
      if (!byId[personId]) {
        fail("data/unions.json", `la union ${union.id} referencia a "${personId}", que no esta en el indice`);
      }
    }
  }

  for (const id of Object.keys(byId)) {
    if (!referenced.has(id)) {
      warn("data/personas-index.json", `"${id}" no aparece en ninguna union`);
    }
  }

  const registry = await readJson("data/trees/index.json");
  const trees = registry && Array.isArray(registry.trees) ? registry.trees : [];
  if (!trees.length) {
    fail("data/trees/index.json", "no declara ninguna vista");
  }
  const keys = new Set();
  for (const tree of trees) {
    if (!tree || !tree.key) {
      fail("data/trees/index.json", "hay una vista sin key");
      continue;
    }
    if (keys.has(tree.key)) {
      fail("data/trees/index.json", `vista duplicada: ${tree.key}`);
    }
    keys.add(tree.key);
    if (!tree.rootPersonId) {
      fail("data/trees/index.json", `la vista "${tree.key}" no declara rootPersonId`);
    } else if (!byId[tree.rootPersonId]) {
      fail("data/trees/index.json", `la raiz de "${tree.key}" no existe: ${tree.rootPersonId}`);
    }
  }
  if (registry && registry.defaultTree && !keys.has(registry.defaultTree)) {
    fail("data/trees/index.json", `defaultTree apunta a una vista inexistente: ${registry.defaultTree}`);
  }

  const listConfig = await readJson("data/lista.json");
  for (const relPath of (listConfig && listConfig.personas) || []) {
    if (!fileExists(relPath)) {
      fail("data/lista.json", `ficha inexistente: ${relPath}`);
    }
  }

  report();
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
      messages.forEach((message) => console.error(`    ERROR  ${message}`));
    }
    for (const [scope, messages] of group(warnings)) {
      console.warn(`\n  ${scope}`);
      messages.forEach((message) => console.warn(`    aviso  ${message}`));
    }
  }

  console.log(`\n${errors.length} errores, ${warnings.length} avisos.`);
  process.exitCode = errors.length ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
