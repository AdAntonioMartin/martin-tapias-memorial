import { fetchJson } from "./net.js";

function normalizeById(payload) {
  return payload && payload.byId && typeof payload.byId === "object" ? payload.byId : {};
}

export function loadByIdIndex(path) {
  if (!path) {
    return Promise.resolve({});
  }
  return fetchJson(path)
    .then(normalizeById)
    .catch(() => ({}));
}
