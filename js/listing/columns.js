import { capitalize } from "../core/text.js";
import { getRecordField } from "../core/person.js";

function formatColumnLabel(key) {
  return capitalize(key || "");
}

export function getColumnValue(record, column) {
  const source = column && column.source ? column.source : column.id;
  const value = getRecordField(record, source);

  if (value === null || value === undefined || value === "") {
    return column && column.defaultValue ? column.defaultValue : "";
  }

  return String(value);
}

export function getColumns(records, configuredColumns) {
  if (Array.isArray(configuredColumns) && configuredColumns.length) {
    return configuredColumns.map((column, index) => {
      if (typeof column === "string") {
        return {
          id: column,
          label: formatColumnLabel(column),
          source: column,
          defaultValue: "",
          type: "string",
          format: ""
        };
      }

      return {
        id: column.id || column.source || `column-${index}`,
        label: column.label || formatColumnLabel(column.id || column.source || ""),
        source: column.source || column.id,
        defaultValue: column.defaultValue || "",
        type: column.type || "string",
        format: column.format || ""
      };
    });
  }

  // Los campos internos (__personPath) no son columnas del listado.
  const inferred = new Set();
  records.forEach((record) => {
    Object.keys(record).forEach((key) => {
      if (key.startsWith("__")) {
        return;
      }
      const value = record[key];
      if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
        inferred.add(key);
      }
    });
  });

  return [...inferred].map((key) => ({
    id: key,
    label: formatColumnLabel(key),
    source: key,
    defaultValue: "",
    type: "string",
    format: ""
  }));
}
