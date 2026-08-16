/*
 * Pruebas del motor del arbol: modelo, recorte y formato.
 *
 * No leen data/ a proposito. Aqui solo se comprueba que el codigo hace lo que
 * dice sobre un grafo conocido; que los datos reales de un sitio sean
 * coherentes lo verifica `npm run validate` (tools/validate-data.mjs), que es
 * lo que tiene sentido ejecutar en el repositorio de cada familia.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { buildTreeModel, toFamilyChartData } from "../js/tree/model.js";
import { collectScopeIds, scopeFamilyChartData } from "../js/tree/scope.js";
import { formatYears } from "../js/tree/format.js";
import { bundle, registry, unions } from "./fixtures/family.js";

const model = buildTreeModel(unions, bundle.people);

test("el modelo cubre a todas las personas referenciadas en las uniones", () => {
  const referenced = new Set();
  unions.forEach((union) => {
    [...union.partners, ...union.children].forEach((id) => referenced.add(id));
  });
  assert.equal(model.people.size, referenced.size);
  assert.deepEqual(model.missingIds, [], "no debe haber personas sin ficha");
});

test("una union que cita a alguien sin ficha lo reporta en missingIds", () => {
  const incompleto = buildTreeModel(
    [{ id: "u-x", partners: ["raiz-uno", "fantasma"], children: [], type: "married" }],
    { "raiz-uno": bundle.people["raiz-uno"] }
  );
  assert.deepEqual(incompleto.missingIds, ["fantasma"]);
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

test("el formato family-chart mantiene el mismo numero de nodos", () => {
  const familyData = toFamilyChartData(model);
  assert.equal(familyData.length, model.people.size);
  for (const entry of familyData) {
    assert.ok(["M", "F"].includes(entry.data.gender));
    assert.ok(["male", "female", "unknown"].includes(entry.data.genderLabel));
  }
});

test("el genero desconocido no se pierde al pasar a family-chart", () => {
  const familyData = toFamilyChartData(model);
  const sinDeterminar = familyData.find((entry) => entry.id === "raiz-dos-pareja");
  assert.equal(sinDeterminar.data.genderLabel, "unknown");
});

test("vistas con raices distintas producen subgrafos de tamanos distintos", () => {
  const sizes = new Map();
  for (const tree of registry.trees) {
    const scope = collectScopeIds(model, tree.rootPersonId);
    assert.ok(scope && scope.size > 1, `la vista ${tree.key} deberia tener personas`);
    sizes.set(tree.key, scope.size);
  }
  assert.ok(
    new Set(sizes.values()).size > 1,
    `las vistas no deberian coincidir: ${JSON.stringify([...sizes])}`
  );
});

test("el recorte alcanza a los descendientes y a sus parejas", () => {
  const scope = collectScopeIds(model, "raiz-uno");
  for (const id of ["raiz-uno", "raiz-uno-pareja", "hijo-uno", "hijo-uno-pareja", "nieta-uno"]) {
    assert.ok(scope.has(id), `${id} deberia entrar en el recorte de raiz-uno`);
  }
  for (const id of ["raiz-dos", "hija-dos"]) {
    assert.ok(!scope.has(id), `${id} es de otra rama y no deberia entrar`);
  }
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
