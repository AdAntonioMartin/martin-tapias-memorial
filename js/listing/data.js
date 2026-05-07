import { unique } from "../core/collections.js";
import { fetchJson, fetchText } from "../core/net.js";
import { resolveHref, toPathOrUrl } from "../core/url.js";
import { APP_CONFIG } from "../config/app-config.js";

export function listPersonFiles(directoryUrl) {
  return fetchText(directoryUrl, "Directorio no disponible")
    .then(function (html) {
      return {
        html: html,
        baseUrl: new URL(directoryUrl, window.location.href).href
      };
    })
    .then(function (payload) {
      var parser = new DOMParser();
      var doc = parser.parseFromString(payload.html, "text/html");
      var links = Array.prototype.slice.call(doc.querySelectorAll("a[href]"));

      return unique(links
        .map(function (anchor) {
          return resolveHref(payload.baseUrl, anchor.getAttribute("href") || "");
        })
        .filter(function (href) {
          return /\.json(?:\?.*)?$/i.test(href);
        })
        .map(toPathOrUrl));
    });
}

export function loadPersonRecords(paths) {
  var requests = paths.map(function (path) {
    return fetchJson(path, "Ficha no disponible")
      .then(function (record) {
        record.__personPath = path;
        return record;
      });
  });

  return Promise.allSettled(requests).then(function (results) {
    return results
      .filter(function (result) { return result.status === "fulfilled"; })
      .map(function (result) { return result.value; });
  });
}

export function loadListConfig(path) {
  return fetchJson(path, "Configuracion no disponible");
}

export function loadPersonPathsFromIndex() {
  var dataConfig = APP_CONFIG && APP_CONFIG.data ? APP_CONFIG.data : {};
  var peopleIndex = dataConfig.peopleIndex || "data/personas-index.json";
  return fetchJson(peopleIndex, "Indice no disponible")
    .then(function (payload) {
      var byId = payload && payload.byId && typeof payload.byId === "object" ? payload.byId : {};
      return Object.keys(byId).map(function (id) { return byId[id]; }).filter(Boolean);
    })
    .catch(function () {
      return [];
    });
}
