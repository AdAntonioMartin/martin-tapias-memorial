import test from "node:test";
import assert from "node:assert/strict";

import { normalizeText, capitalize } from "../js/core/text.js";
import { readPathValue } from "../js/core/object.js";
import { parseDateByFormat, parseNumberLoose } from "../js/core/dates.js";
import { getFactValue, getRecordField } from "../js/core/person.js";

test("normalizeText quita tildes, pasa a minusculas y recorta", () => {
  assert.equal(normalizeText("  Ocupación  "), "ocupacion");
  assert.equal(normalizeText("Fallecimiento"), "fallecimiento");
  assert.equal(normalizeText("Peña"), "pena");
  assert.equal(normalizeText(null), "");
});

test("capitalize solo toca la primera letra", () => {
  assert.equal(capitalize("nacimiento"), "Nacimiento");
  assert.equal(capitalize(""), "");
});

test("readPathValue navega rutas con puntos", () => {
  const record = { heroImage: { src: "images/a.png" } };
  assert.equal(readPathValue(record, "heroImage.src"), "images/a.png");
  assert.equal(readPathValue(record, "heroImage.falta"), undefined);
  assert.equal(readPathValue(record, ""), undefined);
});

test("readPathValue no atraviesa el prototipo", () => {
  assert.equal(readPathValue({}, "constructor"), undefined);
  assert.equal(readPathValue({}, "__proto__.polluted"), undefined);
});

test("parseDateByFormat interpreta dd/mm/yyyy", () => {
  const parsed = parseDateByFormat("30/09/2009", "dd/mm/yyyy");
  const date = new Date(parsed);
  assert.equal(date.getFullYear(), 2009);
  assert.equal(date.getMonth(), 8);
  assert.equal(date.getDate(), 30);
});

test("parseDateByFormat rechaza fechas imposibles y formatos que no casan", () => {
  assert.ok(Number.isNaN(parseDateByFormat("31/02/2009", "dd/mm/yyyy")));
  assert.ok(Number.isNaN(parseDateByFormat("2009", "dd/mm/yyyy")));
  assert.ok(Number.isNaN(parseDateByFormat("", "dd/mm/yyyy")));
  assert.ok(Number.isNaN(parseDateByFormat("30/09/2009", "")));
});

test("parseDateByFormat ordena correctamente dos fechas del listado", () => {
  const antes = parseDateByFormat("29/04/1980", "dd/mm/yyyy");
  const despues = parseDateByFormat("30/09/2009", "dd/mm/yyyy");
  assert.ok(antes < despues);
});

test("parseNumberLoose tolera separadores mixtos", () => {
  assert.equal(parseNumberLoose("88 años"), 88);
  assert.equal(parseNumberLoose("1.234,5"), 1234.5);
  assert.equal(parseNumberLoose("1,234.5"), 1234.5);
  assert.equal(parseNumberLoose(56), 56);
  assert.ok(Number.isNaN(parseNumberLoose("")));
});

test("getFactValue encuentra la etiqueta ignorando tildes y mayusculas", () => {
  const record = {
    facts: [
      { label: "Nacimiento", value: "07/08/1921" },
      { label: "Ocupacion", value: "Labrador" }
    ]
  };
  assert.equal(getFactValue(record, "nacimiento"), "07/08/1921");
  assert.equal(getFactValue(record, "Ocupación"), "Labrador");
  assert.equal(getFactValue(record, "Inexistente"), "");
  assert.equal(getFactValue(null, "Nacimiento"), "");
});

test("getRecordField distingue la sintaxis fact: de la ruta directa", () => {
  const record = {
    name: "Nombre De Prueba",
    facts: [{ label: "Edad", value: "88 años" }]
  };
  assert.equal(getRecordField(record, "name"), "Nombre De Prueba");
  assert.equal(getRecordField(record, "fact:Edad"), "88 años");
  assert.equal(getRecordField(record, ""), "");
});
