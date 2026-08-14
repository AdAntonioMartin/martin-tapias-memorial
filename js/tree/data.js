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

function normalizeTreeRegistry(payload) {
  return {
    defaultTree: (payload && payload.defaultTree) || "",
    trees: payload && Array.isArray(payload.trees) ? payload.trees : []
  };
}

function resolveTreeSources(dataConfig) {
  const requestedTree = getTreeKeyFromUrl();

  return fetchJson(dataConfig.treeRegistry)
    .catch((error) => {
      console.error("tree: no se pudo leer el registro de arboles", error);
      return null;
    })
    .then(normalizeTreeRegistry)
    .then((registry) => {
      const selected =
        (requestedTree && registry.trees.find((entry) => entry && entry.key === requestedTree)) ||
        registry.trees.find((entry) => entry && entry.key === registry.defaultTree) ||
        registry.trees[0] ||
        null;

      if (requestedTree && (!selected || selected.key !== requestedTree)) {
        console.warn(`tree: no existe el arbol "${requestedTree}", se usa el predeterminado`);
      }

      return {
        treeKey: selected ? selected.key : "",
        title: selected ? selected.title : "",
        treeConfigPath: selected ? selected.treeConfig : "",
        peopleIndexPath: selected ? selected.peopleIndex : dataConfig.peopleIndex
      };
    });
}

/** Une el indice del arbol sobre el indice raiz sin pedir el mismo fichero dos veces. */
function loadMergedIndex(treeIndexPath, rootIndexPath) {
  if (!treeIndexPath || treeIndexPath === rootIndexPath) {
    return loadByIdIndex(rootIndexPath);
  }
  return Promise.all([loadByIdIndex(rootIndexPath), loadByIdIndex(treeIndexPath)]).then(
    ([rootById, treeById]) => Object.assign({}, rootById, treeById)
  );
}

function loadPersonRecords(ids, byId) {
  const requests = ids.map((id) => {
    const personPath = byId[id];
    if (!personPath) {
      return Promise.resolve(null);
    }
    return fetchJson(personPath)
      .then((record) => {
        record.__id = record.id || id;
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

  return resolveTreeSources(dataConfig).then((sources) => {
    if (!sources.treeConfigPath) {
      return Promise.reject(new Error("No hay ningun arbol configurado en el registro"));
    }

    return Promise.all([
      fetchJson(sources.treeConfigPath),
      loadMergedIndex(sources.peopleIndexPath, dataConfig.peopleIndex)
    ]).then(([config, byId]) => {
      const unions = Array.isArray(config.unions) ? config.unions : [];

      return loadPersonRecords(getReferencedIds(unions), byId).then((records) => {
        const model = buildTreeModel(unions, records, byId);
        return {
          model,
          familyData: toFamilyChartData(model),
          detailTemplate: getTemplates().detail,
          treeKey: sources.treeKey,
          title: sources.title
        };
      });
    });
  });
}
