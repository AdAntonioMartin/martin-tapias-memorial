import { escapeHtml } from "../core/html.js";
import { t } from "../core/i18n.js";
import { buildPersonUrl } from "../core/url.js";
import { getColumnValue } from "./columns.js";

function messageRow(columnCount, message) {
  return `<tr><td colspan="${columnCount || 1}" class="table-message">${escapeHtml(message)}</td></tr>`;
}

function setStatus(message) {
  const status = document.getElementById("records-status");
  if (status) {
    status.textContent = message || "";
  }
}

export function renderError() {
  const thead = document.getElementById("records-head");
  const tbody = document.getElementById("records-body");
  if (thead) {
    thead.innerHTML = "";
  }
  const message = t("listing.table.error", "No se pudo mostrar el listado en este momento.");
  if (tbody) {
    tbody.innerHTML = messageRow(1, message);
  }
  setStatus(message);
}

export function renderTable(records, columns, config, failedCount) {
  const thead = document.getElementById("records-head");
  const tbody = document.getElementById("records-body");
  if (!tbody) {
    return;
  }

  if (!records.length) {
    if (thead) {
      thead.innerHTML = "";
    }
    const message = t("listing.table.empty", "No hay datos.");
    tbody.innerHTML = messageRow(1, message);
    setStatus(message);
    return;
  }

  if (thead) {
    thead.innerHTML = `<tr>${columns
      .map((column) => `<th scope="col">${escapeHtml(column.label)}</th>`)
      .join("")}</tr>`;
  }

  // Un unico enlace por fila, en la primera celda: antes cada celda repetia el
  // mismo <a>, lo que daba tres paradas de tabulacion identicas por persona y
  // enlaces cuyo texto accesible era una fecha suelta.
  tbody.innerHTML = records
    .map((record) => {
      const href = buildPersonUrl(config.detailTemplate, { id: record.id, personPath: record.__personPath });
      const cells = columns.map((column, index) => {
        const value = escapeHtml(getColumnValue(record, column));
        if (index === 0) {
          return `<td><a class="row-link" href="${escapeHtml(href)}">${value || escapeHtml(record.id || "")}</a></td>`;
        }
        return `<td>${value}</td>`;
      });
      return `<tr class="table-row-link">${cells.join("")}</tr>`;
    })
    .join("");

  const loaded = t("listing.table.loaded", "Listado cargado.");
  setStatus(
    failedCount ? `${loaded} ${t("listing.table.partial", "Algunas fichas no se pudieron cargar.")}` : loaded
  );
}
