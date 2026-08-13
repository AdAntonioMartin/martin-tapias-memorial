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

export function sortRecords(records, sortConfig, columns) {
  const resolved = resolveSort(sortConfig, columns || []);
  if (!resolved) {
    return records;
  }

  return records.slice().sort((a, b) => {
    const aValue = toComparableSortValue(getColumnValue(a, resolved.column), resolved.column.type, resolved.column.format);
    const bValue = toComparableSortValue(getColumnValue(b, resolved.column), resolved.column.type, resolved.column.format);

    if (aValue.empty && bValue.empty) {
      return 0;
    }
    if (aValue.empty) {
      return 1;
    }
    if (bValue.empty) {
      return -1;
    }
    if (aValue.value < bValue.value) {
      return -1 * resolved.direction;
    }
    if (aValue.value > bValue.value) {
      return 1 * resolved.direction;
    }
    return 0;
  });
}
