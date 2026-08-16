import { fetchJson } from "../core/net.js";
import { loadByIdIndex } from "../core/dataIndex.js";
import { getDataConfig } from "../config/index.js";
import { normalizeDataPath } from "../core/url.js";

function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

export function getRequestedPersonId() {
  return getQueryParams().get("id") || "";
}

/**
 * Ruta pedida por `?data=`, ya normalizada. Devuelve "" si apunta fuera de
 * `data/` o a otro origen: sin esto, cualquier enlace podria hacer que la
 * pagina renderizara contenido de terceros bajo nuestro dominio.
 */
export function getRequestedDataPath() {
  return normalizeDataPath(getQueryParams().get("data") || "");
}

export function resolveDetailDataPath() {
  const explicitPath = getRequestedDataPath();
  if (explicitPath) {
    return Promise.resolve(explicitPath);
  }

  const personId = getRequestedPersonId();
  if (!personId) {
    return Promise.resolve(null);
  }

  // Un unico indice: ya no hay uno por familia que fusionar sobre el raiz.
  return loadByIdIndex(getDataConfig().peopleIndex)
    .then((byId) => byId[personId] || null)
    .catch((error) => {
      console.error("detail: no se pudo resolver la ficha", error);
      return null;
    });
}

export function loadPersonData(path) {
  return fetchJson(path, "Contenido no disponible").then((record) => {
    const data = record && typeof record === "object" ? record : {};
    data.gallery = Array.isArray(data.gallery) ? data.gallery.filter((item) => item && item.src) : [];
    data.facts = Array.isArray(data.facts)
      ? data.facts.filter((fact) => fact && fact.label && fact.value)
      : [];
    return data;
  });
}
