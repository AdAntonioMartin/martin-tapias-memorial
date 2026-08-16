import { fetchJson } from "../core/net.js";
import { loadByIdIndex } from "../core/dataIndex.js";
import { getDataConfig } from "../config/index.js";

export function loadPersonRecords(paths) {
  const requests = paths.map((path) =>
    fetchJson(path, "Ficha no disponible").then((record) => {
      record.__personPath = path;
      return record;
    })
  );

  return Promise.allSettled(requests).then((results) => {
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length) {
      console.error(
        `listing: ${failed.length} de ${paths.length} fichas no se pudieron cargar`,
        failed[0].reason
      );
    }
    return {
      records: results.filter((result) => result.status === "fulfilled").map((result) => result.value),
      failed: failed.length
    };
  });
}

export function loadListConfig(path) {
  return fetchJson(path, "Configuracion no disponible");
}

export function loadPersonPathsFromIndex() {
  return loadByIdIndex(getDataConfig().peopleIndex).then((byId) =>
    Object.keys(byId)
      .map((id) => byId[id])
      .filter(Boolean)
  );
}
