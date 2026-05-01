import { fetchJson } from "../core/net.js";

function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

export function getRequestedPersonId() {
  return getQueryParams().get("id");
}

export function getRequestedDataPath() {
  return getQueryParams().get("data");
}

function fetchPersonIndex() {
  return fetchJson("data/personas-index.json", "Indice no disponible")
    .then(function (payload) {
      return payload && payload.byId && typeof payload.byId === "object" ? payload.byId : {};
    });
}

export function resolveDetailDataPath() {
  var explicitPath = getRequestedDataPath();
  if (explicitPath) {
    return Promise.resolve(explicitPath);
  }

  var personId = getRequestedPersonId();
  if (!personId) {
    return Promise.resolve(null);
  }

  return fetchPersonIndex()
    .then(function (byId) {
      return byId[personId] || null;
    })
    .catch(function () {
      return null;
    });
}

export function loadPersonData(path) {
  return fetchJson(path, "Contenido no disponible");
}
