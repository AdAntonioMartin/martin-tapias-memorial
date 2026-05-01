import { normalizeText } from "../core/text.js";
import { parseDateByFormat, parseNumberLoose } from "../core/dates.js";
import { getColumnValue } from "./columns.js";

function parseDateForSort(value, format) {
  var byFormat = parseDateByFormat(value, format);
  if (!Number.isNaN(byFormat)) {
    return byFormat;
  }
  var fallback = Date.parse(String(value || "").trim());
  return Number.isNaN(fallback) ? NaN : fallback;
}

function toComparableSortValue(value, type, format) {
  var text = String(value || "").trim();
  if (!text) {
    return { empty: true, value: "" };
  }

  if (type === "number") {
    var numeric = parseNumberLoose(text);
    if (!Number.isNaN(numeric)) {
      return { empty: false, value: numeric };
    }
  }

  if (type === "date") {
    var date = parseDateForSort(text, format);
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

  var column = null;
  if (sortConfig.source) {
    column = columns.find(function (item) { return item.source === sortConfig.source; }) || null;
  }
  if (!column && sortConfig.id) {
    column = columns.find(function (item) { return item.id === sortConfig.id; }) || null;
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
  var resolved = resolveSort(sortConfig, columns || []);
  if (!resolved) {
    return records;
  }

  return records.slice().sort(function (a, b) {
    var aValue = toComparableSortValue(getColumnValue(a, resolved.column), resolved.column.type, resolved.column.format);
    var bValue = toComparableSortValue(getColumnValue(b, resolved.column), resolved.column.type, resolved.column.format);

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
