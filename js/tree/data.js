import { getDataConfig, getTemplates } from "../config/index.js";
import { fetchJson } from "../core/net.js";
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

/**
 * Dos peticiones para todo el arbol: el registro de vistas y el bundle.
 * Antes se pedia una ficha por persona, unas 197 peticiones en total.
 */
export function loadTreePayload() {
  const dataConfig = getDataConfig();

  return Promise.all([
    fetchJson(dataConfig.treeRegistry).catch((error) => {
      console.error("tree: no se pudo leer el registro de vistas", error);
      return { trees: [] };
    }),
    fetchJson(dataConfig.treeBundle, "No se pudo cargar el arbol")
  ]).then(([registry, bundle]) => {
    const view = resolveTreeView(registry);
    const unions = Array.isArray(bundle.unions) ? bundle.unions : [];
    const model = buildTreeModel(unions, bundle.people);

    return {
      model,
      familyData: toFamilyChartData(model),
      detailTemplate: getTemplates().detail,
      treeKey: view.treeKey,
      title: view.title,
      rootPersonId: view.rootPersonId
    };
  });
}
