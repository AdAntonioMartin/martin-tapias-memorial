import { normalizeText } from "../core/text.js";
import { parseDateByFormat, parseNumberLoose } from "../core/dates.js";
import { getColumnValue } from "./columns.js";

function parseDateForSort(value, format) {
  const byFormat = parseDateByFormat(value, format);
  if (!Number.isNaN(byFormat)) {
    return byFormat;
  }
  const fallback = Date.parse(String(value || "").trim());
  return Number.isNaN(fallback) ? NaN : fallback;
}

function toComparableSortValue(value, type, format) {
  const text = String(value || "").trim();
  if (!text) {
    return { empty: true, value: "" };
  }

  if (type === "number") {
    const numeric = parseNumberLoose(text);
    if (!Number.isNaN(numeric)) {
      return { empty: false, value: numeric };
    }
  }

  if (type === "date") {
    const date = parseDateForSort(text, format);
    if (!Number.isNaN(date)) {
      return { empty: false, value: date };
    }
  }

  return { empty: false, value: normalizeText(text) };
}

function resolveSort(sortConfig, columns) {
  if (!sortConfig || (!sortConfig.source && !sortConfig.id)) {
    return null;
  }

  let column = null;
  if (sortConfig.source) {
    column = columns.find((item) => item.source === sortConfig.source) || null;
  }
  if (!column && sortConfig.id) {
    column = columns.find((item) => item.id === sortConfig.id) || null;
  }
  if (!column && sortConfig.source) {
    column = {
      source: sortConfig.source,
      defaultValue: "",
      type: sortConfig.type || "string",
      format: sortConfig.format || ""
    };
  }
  if (!column) {
    return null;
  }

  return {
    direction: normalizeText(sortConfig.direction) === "desc" ? -1 : 1,
    column: {
      source: column.source,
      defaultValue: column.defaultValue || "",
      type: sortConfig.type || column.type || "string",
      format: sortConfig.format || column.format || ""
    }
  };
}

/**
 * La clave de ordenacion se calcula una vez por registro, no en cada
 * comparacion: antes cada comparacion repetia la busqueda del fact, la
 * normalizacion Unicode y el parseo de fecha, lo que con las 161 fichas son
 * decenas de miles de normalize("NFD").
 */
export function sortRecords(records, sortConfig, columns) {
  const resolved = resolveSort(sortConfig, columns || []);
  if (!resolved) {
    return records;
  }

  const decorated = records.map((record, index) => ({
    record,
    index,
    key: toComparableSortValue(
      getColumnValue(record, resolved.column),
      resolved.column.type,
      resolved.column.format
    )
  }));

  decorated.sort((a, b) => {
    if (a.key.empty !== b.key.empty) {
      // Los vacios van siempre al final, sea cual sea la direccion.
      return a.key.empty ? 1 : -1;
    }
    if (!a.key.empty) {
      if (a.key.value < b.key.value) {
        return -resolved.direction;
      }
      if (a.key.value > b.key.value) {
        return resolved.direction;
      }
    }
    return a.index - b.index;
  });

  return decorated.map((entry) => entry.record);
}
