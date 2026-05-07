import { escapeHtml } from "../core/html.js";
import { t } from "../core/i18n.js";
import { getColumnValue } from "./columns.js";

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

export function renderError() {
  var thead = document.getElementById("records-head");
  var tbody = document.getElementById("records-body");
  if (thead) {
    thead.innerHTML = "";
  }
  if (tbody) {
    tbody.innerHTML = "<tr><td>" + escapeHtml(t("listing.table.error", "No se pudo mostrar el listado en este momento.")) + "</td></tr>";
  }
}

export function renderTable(records, columns, config) {
  var thead = document.getElementById("records-head");
  var tbody = document.getElementById("records-body");
  if (!tbody) {
    return;
  }

  if (!records.length) {
    if (thead) {
      thead.innerHTML = "";
    }
    tbody.innerHTML = "<tr><td>" + escapeHtml(t("listing.table.empty", "No hay datos.")) + "</td></tr>";
    return;
  }

  if (thead) {
    thead.innerHTML = "<tr>" + columns.map(function (column) {
      return "<th>" + escapeHtml(column.label) + "</th>";
    }).join("") + "</tr>";
  }

  tbody.innerHTML = records.map(function (record) {
    var detailUrl = buildDetailUrl(record, config);
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
