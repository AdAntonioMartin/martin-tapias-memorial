import { capitalize } from "../core/text.js";
import { getRecordField } from "../core/person.js";

function formatColumnLabel(key) {
  return capitalize(key || "");
}

export function getColumnValue(record, column) {
  var source = column && column.source ? column.source : column.id;
  var value = getRecordField(record, source);

  if (value === null || value === undefined || value === "") {
    return column && column.defaultValue ? column.defaultValue : "";
  }

  return String(value);
}

export function getColumns(records, configuredColumns) {
  if (Array.isArray(configuredColumns) && configuredColumns.length) {
    return configuredColumns.map(function (column, index) {
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
        id: column.id || column.source || ("column-" + index),
        label: column.label || formatColumnLabel(column.id || column.source || ""),
        source: column.source || column.id,
        defaultValue: column.defaultValue || "",
        type: column.type || "string",
        format: column.format || ""
      };
    });
  }

  var inferred = [];
  records.forEach(function (record) {
    Object.keys(record).forEach(function (key) {
      var value = record[key];
      var isPrimitive = value === null || ["string", "number", "boolean"].indexOf(typeof value) !== -1;
      if (isPrimitive && inferred.indexOf(key) === -1) {
        inferred.push(key);
      }
    });
  });

  return inferred.map(function (key) {
    return {
      id: key,
      label: formatColumnLabel(key),
      source: key,
      defaultValue: "",
      type: "string",
      format: ""
    };
  });
}
