import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildTreeModel, toFamilyChartData } from "../js/tree/model.js";
import { collectScopeIds, scopeFamilyChartData } from "../js/tree/scope.js";
import { formatYears } from "../js/tree/format.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relPath) => JSON.parse(readFileSync(path.join(ROOT, relPath), "utf8"));

const unions = readJson("data/unions.json").unions;
const byId = readJson("data/personas-index.json").byId;
const registry = readJson("data/trees/index.json");
const records = Object.entries(byId).map(([id, relPath]) => ({
  ...readJson(relPath),
  __id: id,
  __path: relPath
}));

const model = buildTreeModel(unions, records, byId);

test("el modelo cubre a todas las personas referenciadas en las uniones", () => {
  const referenced = new Set();
  unions.forEach((union) => {
    [...union.partners, ...union.children].forEach((id) => referenced.add(id));
  });
  assert.equal(model.people.size, referenced.size);
  assert.deepEqual(model.missingIds, [], "no debe haber personas sin ficha");
});

test("las relaciones son simetricas entre padres e hijos", () => {
  for (const [id, person] of model.people) {
    for (const parentId of person.parents) {
      assert.ok(
        model.people.get(parentId).children.includes(id),
        `${parentId} deberia tener a ${id} como hijo`
      );
    }
    for (const spouseId of person.spouses) {
      assert.ok(
        model.people.get(spouseId).spouses.includes(id),
        `${spouseId} y ${id} deberian ser pareja mutua`
      );
    }
  }
});

test("nadie se lista como su propia pareja o su propio ascendiente", () => {
  for (const [id, person] of model.people) {
    assert.ok(!person.spouses.includes(id));
    assert.ok(!person.parents.includes(id));
    assert.ok(!person.children.includes(id));
  }
});

test("ningun nombre visible contiene interrogantes", () => {
  const withQuestionMarks = [...model.people.values()].filter((person) => /\?/.test(person.name));
  assert.deepEqual(withQuestionMarks, []);
});

test("todos los identificadores son estables y aptos para URL", () => {
  for (const id of model.people.keys()) {
    assert.match(id, /^[a-z0-9-]+$/, `identificador no estable: ${id}`);
  }
});

test("el formato family-chart mantiene el mismo numero de nodos", () => {
  const familyData = toFamilyChartData(model);
  assert.equal(familyData.length, model.people.size);
  for (const entry of familyData) {
    assert.ok(["M", "F"].includes(entry.data.gender));
    assert.ok(["male", "female", "unknown"].includes(entry.data.genderLabel));
  }
});

test("las tres vistas familiares producen subgrafos distintos", () => {
  const sizes = new Map();
  for (const tree of registry.trees) {
    const scope = collectScopeIds(model, tree.rootPersonId);
    assert.ok(scope && scope.size > 1, `la vista ${tree.key} deberia tener personas`);
    sizes.set(tree.key, scope.size);
  }
  const distinct = new Set(sizes.values());
  assert.ok(distinct.size > 1, `las vistas no deberian coincidir: ${JSON.stringify([...sizes])}`);
});

test("el recorte no deja relaciones apuntando fuera del subgrafo", () => {
  const familyData = toFamilyChartData(model);
  const scope = collectScopeIds(model, registry.trees[0].rootPersonId);
  const scoped = scopeFamilyChartData(familyData, scope);
  const ids = new Set(scoped.map((entry) => entry.id));

  for (const entry of scoped) {
    for (const related of [...entry.rels.parents, ...entry.rels.spouses, ...entry.rels.children]) {
      assert.ok(ids.has(related), `${entry.id} apunta a ${related}, que no esta en el recorte`);
    }
  }
});

test("el recorte no muta los datos de origen", () => {
  const familyData = toFamilyChartData(model);
  const before = JSON.stringify(familyData);
  const scoped = scopeFamilyChartData(familyData, collectScopeIds(model, registry.trees[0].rootPersonId));
  scoped[0].rels.parents.push("intruso");
  scoped[0].data.name = "modificado";
  assert.equal(JSON.stringify(familyData), before);
});

test("formatYears lee las fechas ISO ya estructuradas", () => {
  assert.equal(formatYears({ born: "1921-08-07", died: "2009-09-30" }), "1921 - 2009");
  assert.equal(formatYears({ born: "1890", died: "" }), "n. 1890");
  assert.equal(formatYears({ born: "", died: "1975-01-02" }), "† 1975");
  assert.equal(formatYears({ born: "", died: "" }), "");
});

test("las imagenes de galeria no se repiten dentro de una ficha", () => {
  for (const record of records) {
    const keys = (record.gallery || []).map((image) => image.full || image.src);
    assert.equal(new Set(keys).size, keys.length, `galeria con repeticiones en ${record.id}`);
  }
});
