function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPageConfig() {
  var page = document.querySelector(".page");

  return {
    listSrc: page ? page.dataset.recordsSrc : "data/lista.json",
    detailTemplate: page ? page.dataset.detailTemplate : "persona.html"
  };
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatColumnLabel(key) {
  if (!key) {
    return "";
  }

  return key.charAt(0).toUpperCase() + key.slice(1);
}

function readPathValue(object, path) {
  if (!path) {
    return "";
  }

  return path.split(".").reduce(function (current, part) {
    if (current && Object.prototype.hasOwnProperty.call(current, part)) {
      return current[part];
    }

    return undefined;
  }, object);
}

function getFactValue(record, label) {
  var facts = Array.isArray(record.facts) ? record.facts : [];
  var targetLabel = normalizeText(label);

  for (var i = 0; i < facts.length; i += 1) {
    if (normalizeText(facts[i].label) === targetLabel) {
      return facts[i].value;
    }
  }

  return "";
}

function getColumnValue(record, column) {
  var source = column && column.source ? column.source : column.id;
  var value;

  if (!source) {
    return "";
  }

  if (source.indexOf("fact:") === 0) {
    value = getFactValue(record, source.slice(5));
  } else {
    value = readPathValue(record, source);
  }

  if (value === null || value === undefined || value === "") {
    return column && column.defaultValue ? column.defaultValue : "";
  }

  return String(value);
}

function getColumns(records, configuredColumns) {
  if (Array.isArray(configuredColumns) && configuredColumns.length) {
    return configuredColumns.map(function (column, index) {
      if (typeof column === "string") {
        return {
          id: column,
          label: formatColumnLabel(column),
          source: column,
          type: "string",
          format: ""
        };
      }

      return {
        id: column.id || column.source || "column-" + index,
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
      type: "string",
      format: ""
    };
  });
}

function normalizeDateFormat(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function parseNumberForSort(value) {
  if (typeof value === "number") {
    return value;
  }

  var text = String(value || "")
    .replace(/\u00A0/g, " ")
    .trim()
    .replace(/[^0-9,.\-]/g, "");

  if (!text) {
    return NaN;
  }

  if (text.indexOf(",") !== -1 && text.indexOf(".") !== -1) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (text.indexOf(",") !== -1) {
    text = text.replace(",", ".");
  }

  return Number(text);
}

function parseDateByFormat(value, format) {
  var text = String(value || "").trim();
  var pattern = normalizeDateFormat(format);

  if (!text || !pattern) {
    return NaN;
  }

  var formatParts = pattern.split(/[^a-z]/).filter(Boolean);
  var valueParts = text.split(/[^0-9]/).filter(Boolean);

  if (formatParts.length !== valueParts.length) {
    return NaN;
  }

  var day = NaN;
  var month = NaN;
  var year = NaN;

  for (var i = 0; i < formatParts.length; i += 1) {
    var token = formatParts[i];
    var parsed = parseInt(valueParts[i], 10);

    if (Number.isNaN(parsed)) {
      return NaN;
    }

    if (token === "d" || token === "dd") {
      day = parsed;
    } else if (token === "m" || token === "mm") {
      month = parsed;
    } else if (token === "yyyy") {
      year = parsed;
    } else if (token === "yy") {
      year = parsed + (parsed >= 70 ? 1900 : 2000);
    } else {
      return NaN;
    }
  }

  if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) {
    return NaN;
  }

  var date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return NaN;
  }

  return date.getTime();
}

function parseDateForSort(value, format) {
  var byFormat = parseDateByFormat(value, format);
  if (!Number.isNaN(byFormat)) {
    return byFormat;
  }

  var timestamp = Date.parse(String(value || "").trim());
  return Number.isNaN(timestamp) ? NaN : timestamp;
}

function getSortConfig(sortConfig, columns) {
  var sortSource = sortConfig && sortConfig.source ? sortConfig.source : "";
  var sortId = sortConfig && sortConfig.id ? sortConfig.id : "";
  var column = null;

  if (sortSource) {
    column = columns.find(function (item) {
      return item.source === sortSource;
    }) || null;
  }

  if (!column && sortId) {
    column = columns.find(function (item) {
      return item.id === sortId;
    }) || null;
  }

  if (!column && sortSource) {
    column = {
      source: sortSource,
      defaultValue: "",
      type: sortConfig.type || "string",
      format: sortConfig.format || ""
    };
  }

  if (!column) {
    return null;
  }

  return {
    direction: normalizeText(sortConfig && sortConfig.direction) === "desc" ? -1 : 1,
    column: {
      source: column.source,
      defaultValue: column.defaultValue || "",
      type: sortConfig.type || column.type || "string",
      format: sortConfig.format || column.format || ""
    }
  };
}

function toComparableSortValue(value, type, format) {
  var text = String(value || "").trim();

  if (!text) {
    return { empty: true, type: "string", value: "" };
  }

  if (type === "number") {
    var parsedNumber = parseNumberForSort(text);
    if (!Number.isNaN(parsedNumber)) {
      return { empty: false, type: "number", value: parsedNumber };
    }
  }

  if (type === "date") {
    var parsedDate = parseDateForSort(text, format);
    if (!Number.isNaN(parsedDate)) {
      return { empty: false, type: "number", value: parsedDate };
    }
  }

  return {
    empty: false,
    type: "string",
    value: normalizeText(text)
  };
}

function sortRecords(records, sortConfig, columns) {
  if (!sortConfig || (!sortConfig.source && !sortConfig.id)) {
    return records;
  }

  var resolvedSort = getSortConfig(sortConfig, columns || []);
  if (!resolvedSort) {
    return records;
  }

  return records.slice().sort(function (a, b) {
    var rawA = getColumnValue(a, resolvedSort.column);
    var rawB = getColumnValue(b, resolvedSort.column);
    var aValue = toComparableSortValue(rawA, resolvedSort.column.type, resolvedSort.column.format);
    var bValue = toComparableSortValue(rawB, resolvedSort.column.type, resolvedSort.column.format);

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
      return -1 * resolvedSort.direction;
    }

    if (aValue.value > bValue.value) {
      return 1 * resolvedSort.direction;
    }

    return 0;
  });
}

function toUniqueList(values) {
  return values.filter(function (value, index) {
    return values.indexOf(value) === index;
  });
}

function resolveHref(baseUrl, href) {
  try {
    return new URL(href, baseUrl).href;
  } catch (error) {
    return "";
  }
}

function toPathOrUrl(value) {
  try {
    var url = new URL(value, window.location.href);
    if (url.origin === window.location.origin) {
      return url.pathname + url.search;
    }

    return url.href;
  } catch (error) {
    return value;
  }
}

function listPersonFiles(directoryUrl) {
  return fetch(directoryUrl)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Directorio no disponible");
      }

      return response.text().then(function (html) {
        return {
          html: html,
          baseUrl: response.url
        };
      });
    })
    .then(function (payload) {
      var parser = new DOMParser();
      var doc = parser.parseFromString(payload.html, "text/html");
      var links = Array.prototype.slice.call(doc.querySelectorAll("a[href]"));

      return toUniqueList(links.map(function (anchor) {
        var href = anchor.getAttribute("href") || "";
        return resolveHref(payload.baseUrl, href);
      }).filter(function (href) {
        return /\.json(?:\?.*)?$/i.test(href);
      }).map(toPathOrUrl));
    });
}

function loadPersonRecords(paths) {
  var requests = paths.map(function (path) {
    return fetch(path)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Ficha no disponible");
        }

        return response.json();
      })
      .then(function (record) {
        record.__personPath = path;
        return record;
      });
  });

  return Promise.allSettled(requests).then(function (results) {
    return results.filter(function (result) {
      return result.status === "fulfilled";
    }).map(function (result) {
      return result.value;
    });
  });
}

function buildDetailUrl(record, config) {
  var params = new URLSearchParams();
  if (record.id) {
    params.set("id", record.id);
  }
  if (record.__personPath) {
    params.set("data", record.__personPath);
  }
  return (config.detailTemplate || "persona.html") + "?" + params.toString();
}

function renderTable(records, listConfig) {
  var thead = document.getElementById("records-head");
  var tbody = document.getElementById("records-body");
  var columns = getColumns(records, listConfig.columns);

  if (!records.length) {
    if (thead) {
      thead.innerHTML = "";
    }
    tbody.innerHTML = '<tr><td>No hay datos.</td></tr>';
    return;
  }

  if (thead) {
    thead.innerHTML =
      "<tr>" +
      columns.map(function (column) {
        return "<th>" + escapeHtml(column.label) + "</th>";
      }).join("") +
      "</tr>";
  }

  tbody.innerHTML = records.map(function (record) {
    var detailUrl = buildDetailUrl(record, listConfig);

    return (
      '<tr class="table-row-link">' +
        columns.map(function (column) {
          return (
            '<td><a class="row-link" href="' + escapeHtml(detailUrl) + '">' +
              escapeHtml(getColumnValue(record, column)) +
            "</a></td>"
          );
        }).join("") +
      "</tr>"
    );
  }).join("");
}

function renderError() {
  var thead = document.getElementById("records-head");
  var tbody = document.getElementById("records-body");
  if (thead) {
    thead.innerHTML = "";
  }
  tbody.innerHTML = '<tr><td>No se pudo mostrar el listado en este momento.</td></tr>';
}

function loadRecords() {
  var pageConfig = getPageConfig();

  fetch(pageConfig.listSrc)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Configuracion no disponible");
      }

      return response.json();
    })
    .then(function (listConfig) {
      var directory = listConfig.personasPath || "data/personas/";
      var fallbackPaths = Array.isArray(listConfig.personas) ? listConfig.personas : [];

      return listPersonFiles(directory)
        .then(function (paths) {
          return paths.length ? paths : fallbackPaths;
        })
        .catch(function () {
          return fallbackPaths;
        })
        .then(function (paths) {
          return loadPersonRecords(paths).then(function (records) {
            var mergedConfig = {
              columns: listConfig.columns,
              sort: listConfig.sort,
              detailTemplate: listConfig.detailTemplate || pageConfig.detailTemplate
            };
            var columns = getColumns(records, mergedConfig.columns);
            return {
              records: sortRecords(records, mergedConfig.sort, columns),
              config: mergedConfig
            };
          });
        });
    })
    .then(function (payload) {
      renderTable(payload.records, payload.config);
    })
    .catch(function () {
      renderError();
    });
}

document.addEventListener("DOMContentLoaded", loadRecords);
