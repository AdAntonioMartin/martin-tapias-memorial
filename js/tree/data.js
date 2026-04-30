import { normalizeDataPath } from "./utils.js";

export function fetchJson(path) {
  return fetch(path).then(function (response) {
    if (!response.ok) {
      throw new Error("No se pudo cargar " + path);
    }
    return response.json();
  });
}

export function getLaunchTarget() {
  var params = new URLSearchParams(window.location.search);
  return {
    id: params.get("id") || "",
    dataPath: normalizeDataPath(params.get("data") || "")
  };
}

function getReferencedIds(unions) {
  var set = {};
  (Array.isArray(unions) ? unions : []).forEach(function (union) {
    (union.partners || []).forEach(function (id) {
      if (id) {
        set[id] = true;
      }
    });
    (union.children || []).forEach(function (id) {
      if (id) {
        set[id] = true;
      }
    });
  });
  return Object.keys(set);
}

function loadPersonRecordsById(ids, byId) {
  var requests = ids.map(function (id) {
    var personPath = byId[id];
    if (!personPath) {
      return Promise.resolve(null);
    }
    return fetchJson(personPath)
      .then(function (record) {
        record.__id = record.id || id;
        record.__path = personPath;
        return record;
      })
      .catch(function () {
        return null;
      });
  });

  return Promise.all(requests).then(function (results) {
    return results.filter(Boolean);
  });
}

export function loadTreePayload() {
  return Promise.all([
    fetchJson("data/arbol.json"),
    fetchJson("data/personas-index.json").catch(function () { return { byId: {} }; })
  ]).then(function (payload) {
    var config = payload[0] || {};
    var indexPayload = payload[1] || {};
    var byId = indexPayload.byId && typeof indexPayload.byId === "object" ? indexPayload.byId : {};
    var unions = Array.isArray(config.unions) ? config.unions : [];
    var ids = getReferencedIds(unions);

    return loadPersonRecordsById(ids, byId).then(function (records) {
      return {
        unions: unions,
        records: records,
        byId: byId,
        detailTemplate: config.detailTemplate || "persona.html"
      };
    });
  });
}
