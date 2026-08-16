import { getFactValue } from "../core/person.js";

function extractYear(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  const iso = text.match(/^(\d{4})(?:-\d{2})?(?:-\d{2})?$/);
  if (iso) {
    return iso[1];
  }
  const slash = text.match(/\/(\d{4})$/);
  if (slash) {
    return slash[1];
  }
  const plain = text.match(/\b(\d{4})\b/);
  return plain ? plain[1] : "";
}

/**
 * Anos de vida para la tarjeta del arbol.
 * Prioriza los campos estructurados `born`/`died`; los facts en castellano son
 * el respaldo para fechas que no se pudieron normalizar a ISO.
 */
export function formatYears(record) {
  if (!record) {
    return "";
  }
  const bornYear = extractYear(record.born || getFactValue(record, "Nacimiento"));
  const diedYear = extractYear(record.died || getFactValue(record, "Fallecimiento"));

  if (bornYear && diedYear) {
    return `${bornYear} - ${diedYear}`;
  }
  if (bornYear) {
    return `n. ${bornYear}`;
  }
  return diedYear ? `† ${diedYear}` : "";
}
