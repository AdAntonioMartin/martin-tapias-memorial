import { getDataConfig, getTemplates } from "../config/app-config.js";
import { fetchJson } from "../core/net.js";
import { loadByIdIndex } from "../core/dataIndex.js";
import { getTreeKeyFromUrl, normalizeDataPath } from "../core/url.js";
import { buildTreeModel, toFamilyChartData } from "./model.js";

export function getLaunchTarget() {
  const params = new URLSearchParams(window.location.search);
  return {
    id: params.get("id") || "",
    dataPath: normalizeDataPath(params.get("data") || "")
  };
}

/**
 * Un arbol es una vista sobre el grafo unico, no una copia de los datos.
 * Antes habia un arbol.json por familia: los de "martin" y "deantonio" eran
 * identicos byte a byte, y sus 55 uniones un subconjunto estricto de las 59
 * del tercero. Ahora la familia se define por la persona raiz desde la que se
 * recorta el subgrafo.
 */
function resolveTreeView(registry) {
  const requestedKey = getTreeKeyFromUrl();
  const trees = registry && Array.isArray(registry.trees) ? registry.trees : [];

  const selected =
    (requestedKey && trees.find((tree) => tree && tree.key === requestedKey)) ||
    trees.find((tree) => tree && tree.key === registry.defaultTree) ||
    trees[0] ||
    null;

  if (requestedKey && (!selected || selected.key !== requestedKey)) {
    console.warn(`tree: no existe la vista "${requestedKey}", se usa la predeterminada`);
  }

  return {
    treeKey: selected ? selected.key : "",
    title: selected ? selected.title : "",
    rootPersonId: selected ? selected.rootPersonId || "" : ""
  };
}

function loadPersonRecords(ids, byId) {
  const requests = ids.map((id) => {
    const personPath = byId[id];
    if (!personPath) {
      return Promise.resolve(null);
    }
    return fetchJson(personPath)
      .then((record) => {
        record.__path = personPath;
        return record;
      })
      .catch((error) => {
        console.error(`tree: no se pudo cargar la ficha de "${id}"`, error);
        return null;
      });
  });

  return Promise.all(requests).then((results) => results.filter(Boolean));
}

function getReferencedIds(unions) {
  const ids = new Set();
  (Array.isArray(unions) ? unions : []).forEach((union) => {
    (union.partners || []).forEach((id) => id && ids.add(id));
    (union.children || []).forEach((id) => id && ids.add(id));
  });
  return [...ids];
}

export function loadTreePayload() {
  const dataConfig = getDataConfig();

  return Promise.all([
    fetchJson(dataConfig.treeRegistry).catch((error) => {
      console.error("tree: no se pudo leer el registro de vistas", error);
      return { trees: [] };
    }),
    fetchJson(dataConfig.unions),
    loadByIdIndex(dataConfig.peopleIndex)
  ]).then(([registry, unionsPayload, byId]) => {
    const view = resolveTreeView(registry);
    const unions = Array.isArray(unionsPayload.unions) ? unionsPayload.unions : [];

    return loadPersonRecords(getReferencedIds(unions), byId).then((records) => {
      const model = buildTreeModel(unions, records, byId);
      return {
        model,
        familyData: toFamilyChartData(model),
        detailTemplate: getTemplates().detail,
        treeKey: view.treeKey,
        title: view.title,
        rootPersonId: view.rootPersonId
      };
    });
  });
}
