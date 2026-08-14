/**
 * Normaliza una ruta de datos a la forma `data/...` relativa al sitio.
 * Devuelve "" si la ruta apunta fuera del origen o se sale de `data/`.
 */
export function normalizeDataPath(value) {
  if (!value) {
    return "";
  }

  const raw = String(value).replace(/\\/g, "/").trim();
  let normalized = raw;
  try {
    const parsed = new URL(raw, window.location.href);
    if (parsed.origin !== window.location.origin) {
      return "";
    }
    normalized = parsed.pathname;
  } catch {
    // Ruta relativa sin forma de URL: se usa tal cual.
  }

  normalized = decodeURIComponent(normalized)
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "");

  if (!normalized.startsWith("data/") || normalized.includes("..")) {
    return "";
  }
  return normalized;
}

export function inferTreeKeyFromPath(path) {
  const match = String(path || "").match(/^data\/trees\/([^/]+)\//);
  return match && match[1] ? match[1] : "";
}

/** Unica lectura del parametro `?tree=` de toda la aplicacion. */
export function getTreeKeyFromUrl() {
  return new URLSearchParams(window.location.search).get("tree") || "";
}

export function buildQueryUrl(base, params) {
  const qs = new URLSearchParams();
  Object.keys(params || {}).forEach((key) => {
    if (params[key]) {
      qs.set(key, params[key]);
    }
  });
  const query = qs.toString();
  return query ? `${base}?${query}` : base;
}

/** Enlace a la ficha de una persona, usado por el listado y por el panel del arbol. */
export function buildPersonUrl(template, { id, personPath, treeKey } = {}) {
  return buildQueryUrl(template || "persona.html", {
    tree: treeKey || inferTreeKeyFromPath(personPath),
    id,
    data: personPath
  });
}
