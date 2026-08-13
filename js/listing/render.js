import { escapeHtml } from "../core/html.js";
import { t } from "../core/i18n.js";
import { inferTreeKeyFromPath, buildQueryUrl } from "../core/url.js";
import { getColumnValue } from "./columns.js";

function buildDetailUrl(record, config) {
  const personPath = record.__personPath || "";
  return buildQueryUrl(config.detailTemplate || "persona.html", {
    tree: inferTreeKeyFromPath(personPath),
    id: record.id,
    data: personPath
  });
}

export function renderError() {
  const thead = document.getElementById("records-head");
  const tbody = document.getElementById("records-body");
  if (thead) {
    thead.innerHTML = "";
  }
  if (tbody) {
    tbody.innerHTML = `<tr><td>${escapeHtml(t("listing.table.error", "No se pudo mostrar el listado en este momento."))}</td></tr>`;
  }
}

export function renderTable(records, columns, config) {
  const thead = document.getElementById("records-head");
  const tbody = document.getElementById("records-body");
  if (!tbody) {
    return;
  }

  if (!records.length) {
    if (thead) {
      thead.innerHTML = "";
    }
    tbody.innerHTML = `<tr><td>${escapeHtml(t("listing.table.empty", "No hay datos."))}</td></tr>`;
    return;
  }

  if (thead) {
    thead.innerHTML = `<tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr>`;
  }

  tbody.innerHTML = records
    .map((record) => {
      const detailUrl = buildDetailUrl(record, config);
      return (
        '<tr class="table-row-link">' +
        columns
          .map(
            (column) =>
              `<td><a class="row-link" href="${escapeHtml(detailUrl)}">${escapeHtml(getColumnValue(record, column))}</a></td>`
          )
          .join("") +
        "</tr>"
      );
    })
    .join("");
}
