import { unique } from "../core/collections.js";
import { fetchJson, fetchText } from "../core/net.js";
import { resolveHref, toPathOrUrl } from "../core/url.js";
import { loadByIdIndex } from "../core/dataIndex.js";
import { getDataConfig } from "../config/app-config.js";

export function listPersonFiles(directoryUrl) {
  return fetchText(directoryUrl, "Directorio no disponible")
    .then((html) => ({
      html,
      baseUrl: new URL(directoryUrl, window.location.href).href
    }))
    .then((payload) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(payload.html, "text/html");
      const links = Array.from(doc.querySelectorAll("a[href]"));

      return unique(
        links
          .map((anchor) => resolveHref(payload.baseUrl, anchor.getAttribute("href") || ""))
          .filter((href) => /\.json(?:\?.*)?$/i.test(href))
          .map(toPathOrUrl)
      );
    });
}

export function loadPersonRecords(paths) {
  const requests = paths.map((path) =>
    fetchJson(path, "Ficha no disponible").then((record) => {
      record.__personPath = path;
      return record;
    })
  );

  return Promise.allSettled(requests).then((results) =>
    results.filter((result) => result.status === "fulfilled").map((result) => result.value)
  );
}

export function loadListConfig(path) {
  return fetchJson(path, "Configuracion no disponible");
}

export function loadPersonPathsFromIndex() {
  const peopleIndex = getDataConfig().peopleIndex || "data/personas-index.json";
  return loadByIdIndex(peopleIndex).then((byId) =>
    Object.keys(byId).map((id) => byId[id]).filter(Boolean)
  );
}
