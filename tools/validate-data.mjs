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
import { siteRoot } from "./lib/site-config.mjs";

const ROOT = siteRoot();
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

  await validateBundle(byId, unions);
  await validateViews(byId, unions, trees);

  report();
}

/**
 * El bundle es un derivado: si alguien edita una ficha y no ejecuta
 * `npm run build`, el arbol muestra datos viejos sin que falle nada.
 * Esta comprobacion vivia en los tests, que leian data/ y por eso no podian
 * viajar con el motor.
 */
async function validateBundle(byId, unions) {
  const scope = "data/tree-bundle.json";
  const bundle = await readJson("data/tree-bundle.json");
  if (!bundle) {
    return;
  }

  if (JSON.stringify(bundle.unions) !== JSON.stringify(unions)) {
    fail(scope, "las uniones del bundle no coinciden con data/unions.json; ejecuta npm run build");
  }

  const people = bundle.people || {};
  const enBundle = Object.keys(people).sort();
  const enIndice = Object.keys(byId).sort();
  if (JSON.stringify(enBundle) !== JSON.stringify(enIndice)) {
    fail(scope, "el bundle no tiene exactamente las mismas personas que el indice; ejecuta npm run build");
    return;
  }

  for (const [id, relPath] of Object.entries(byId)) {
    const record = await readJson(relPath);
    const entry = people[id];
    if (!record || !entry) {
      continue;
    }
    for (const field of ["name", "gender", "born", "died"]) {
      if ((entry[field] || "") !== (record[field] || "")) {
        fail(scope, `"${field}" desincronizado en ${id}; ejecuta npm run build`);
      }
    }
  }
}

/**
 * Cada vista recorta el grafo desde su raiz. Dos vistas que devuelven
 * exactamente el mismo subgrafo son casi siempre un error de configuracion:
 * antes existian ficheros por familia que resultaron ser copias identicas.
 */
async function validateViews(byId, unions, trees) {
  const { buildTreeModel } = await import("../js/tree/model.js");
  const { collectScopeIds } = await import("../js/tree/scope.js");

  const people = {};
  for (const [id, relPath] of Object.entries(byId)) {
    const record = await readJson(relPath);
    if (record) {
      people[id] = record;
    }
  }

  const model = buildTreeModel(unions, people);
  if (model.missingIds.length) {
    fail("data/unions.json", `personas referenciadas sin ficha: ${model.missingIds.join(", ")}`);
  }

  const sizes = new Map();
  for (const tree of trees) {
    if (!tree || !tree.rootPersonId || !byId[tree.rootPersonId]) {
      continue;
    }
    const scope = collectScopeIds(model, tree.rootPersonId);
    if (!scope || scope.size <= 1) {
      fail("data/trees/index.json", `la vista "${tree.key}" no alcanza a nadie mas que a su raiz`);
      continue;
    }
    sizes.set(tree.key, scope.size);
  }

  const repetidos = [...sizes.entries()].filter(
    ([, size]) => [...sizes.values()].filter((other) => other === size).length > 1
  );
  if (sizes.size > 1 && repetidos.length) {
    warn(
      "data/trees/index.json",
      `vistas del mismo tamano, revisa que no sean la misma: ${repetidos.map(([key, size]) => `${key} (${size})`).join(", ")}`
    );
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
