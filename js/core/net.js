const DEFAULT_TIMEOUT_MS = 15000;

/** Peticiones en vuelo o ya resueltas, para no pedir dos veces el mismo JSON. */
const jsonCache = new Map();

function fetchWithTimeout(path, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(path, { signal: controller.signal, headers: { Accept: "application/json" } })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`${path}: el servidor respondio ${response.status}`);
      }
      return response;
    })
    .finally(() => clearTimeout(timer));
}

/**
 * Descarga y parsea un JSON. Las respuestas se memoizan por ruta, asi que
 * pedir el mismo fichero desde dos modulos cuesta una sola peticion.
 */
export function fetchJson(path, errorMessage, options) {
  const opts = options || {};
  if (!opts.noCache && jsonCache.has(path)) {
    return jsonCache.get(path);
  }

  const promise = fetchWithTimeout(path, opts.timeoutMs || DEFAULT_TIMEOUT_MS)
    .then((response) => response.json())
    .catch((error) => {
      jsonCache.delete(path);
      const reason =
        error && error.name === "AbortError" ? "la peticion excedio el tiempo limite" : error.message;
      throw new Error(
        errorMessage ? `${errorMessage} (${path}: ${reason})` : `No se pudo cargar ${path}: ${reason}`
      );
    });

  if (!opts.noCache) {
    jsonCache.set(path, promise);
  }
  return promise;
}
