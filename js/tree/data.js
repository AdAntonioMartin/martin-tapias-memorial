import { APP_CONFIG, getDataConfig } from "../config/app-config.js";
import { fetchJson } from "../core/net.js";
import { loadByIdIndex } from "../core/dataIndex.js";
import { normalizeDataPath } from "../core/url.js";
import { formatYears } from "./format.js";

export function getLaunchTarget() {
  const params = new URLSearchParams(window.location.search);
  return {
    id: params.get("id") || "",
    dataPath: normalizeDataPath(params.get("data") || ""),
    tree: params.get("tree") || ""
  };
}

function getRequestedTreeKey() {
  const params = new URLSearchParams(window.location.search);
  return params.get("tree") || "";
}

function normalizeTreeRegistry(payload) {
  const defaultTree = payload && payload.defaultTree ? payload.defaultTree : "global";
  const trees = payload && Array.isArray(payload.trees) ? payload.trees : [];
  return {
    defaultTree,
    trees
  };
}

function resolveTreeSources(appDataConfig) {
  const treeConfigPath = appDataConfig.treeConfig || "data/arbol.json";
  const peopleIndexPath = appDataConfig.peopleIndex || "data/personas-index.json";
  const treeRegistryPath = appDataConfig.treeRegistry || "data/trees/index.json";
  const requestedTree = getRequestedTreeKey();

  return fetchJson(treeRegistryPath)
    .then(normalizeTreeRegistry)
    .catch(() => ({ defaultTree: "global", trees: [] }))
    .then((registry) => {
      let selected = null;
      if (requestedTree) {
        selected = registry.trees.find((entry) => entry && entry.key === requestedTree) || null;
      }
      if (!selected && registry.defaultTree) {
        selected = registry.trees.find((entry) => entry && entry.key === registry.defaultTree) || null;
      }
      return {
        treeKey: selected && selected.key ? selected.key : requestedTree || registry.defaultTree || "global",
        treeConfigPath: selected && selected.treeConfig ? selected.treeConfig : treeConfigPath,
        peopleIndexPath: selected && selected.peopleIndex ? selected.peopleIndex : peopleIndexPath,
        imagesBase: selected && selected.imagesBase ? selected.imagesBase : "images/personas"
      };
    });
}

function remapImagePath(src, imagesBase) {
  if (!src) {
    return src;
  }
  const value = String(src);
  if (value.indexOf("images/personas/") === 0) {
    return value;
  }
  if (!imagesBase) {
    return value;
  }
  if (value.indexOf("images/trees/shared/personas/") === 0) {
    return value.replace("images/trees/shared/personas/", `${imagesBase.replace(/\/+$/, "")}/`);
  }
  return value;
}

function getReferencedIds(unions) {
  const set = {};
  (Array.isArray(unions) ? unions : []).forEach((union) => {
    (union.partners || []).forEach((id) => {
      if (id) {
        set[id] = true;
      }
    });
    (union.children || []).forEach((id) => {
      if (id) {
        set[id] = true;
      }
    });
  });
  return Object.keys(set);
}

function normalizeGender(gender) {
  if (gender === "male") {
    return "male";
  }
  if (gender === "female") {
    return "female";
  }
  return "unknown";
}

function toFamilyChartGender(gender) {
  return gender === "male" ? "M" : "F";
}

function titleFromId(id) {
  return String(id || "")
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function loadPersonRecordsById(ids, byId) {
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
      .catch(() => null);
  });

  return Promise.all(requests).then((results) => results.filter(Boolean));
}

function getOrCreatePerson(nodesById, id, byId, recordById) {
  if (!nodesById[id]) {
    const record = recordById[id] || null;
    const gender = normalizeGender(record && record.gender);
    const name = record && record.name ? record.name : titleFromId(id);
    const years = formatYears(record);
    const photo = record && record.heroImage ? record.heroImage.src : "";
    const personPath = record && record.__path ? record.__path : byId[id] || "";
    nodesById[id] = {
      id,
      name,
      years,
      gender,
      personPath,
      photo,
      summary: record && record.summary ? record.summary : "",
      record
    };
  }
  return nodesById[id];
}

function addRel(target, field, value) {
  if (!value) {
    return;
  }
  if (target[field].indexOf(value) === -1) {
    target[field].push(value);
  }
}

function mapFamilyChartData(unions, byId, records) {
  const recordById = {};
  const nodesById = {};
  const relsById = {};

  records.forEach((record) => {
    if (record && record.__id) {
      recordById[record.__id] = record;
    }
    if (record && record.id) {
      recordById[record.id] = record;
    }
  });

  (Array.isArray(unions) ? unions : []).forEach((union) => {
    const partners = Array.isArray(union.partners) ? union.partners.filter(Boolean) : [];
    const children = Array.isArray(union.children) ? union.children.filter(Boolean) : [];

    partners.forEach((id) => {
      getOrCreatePerson(nodesById, id, byId, recordById);
      if (!relsById[id]) {
        relsById[id] = { parents: [], spouses: [], children: [] };
      }
    });
    children.forEach((id) => {
      getOrCreatePerson(nodesById, id, byId, recordById);
      if (!relsById[id]) {
        relsById[id] = { parents: [], spouses: [], children: [] };
      }
    });

    partners.forEach((partnerId) => {
      partners.forEach((spouseId) => {
        if (spouseId !== partnerId) {
          addRel(relsById[partnerId], "spouses", spouseId);
        }
      });
      children.forEach((childId) => {
        addRel(relsById[partnerId], "children", childId);
      });
    });

    children.forEach((childId) => {
      partners.forEach((parentId) => {
        addRel(relsById[childId], "parents", parentId);
      });
    });
  });

  return Object.keys(nodesById).map((id) => {
    const person = nodesById[id];
    const rels = relsById[id] || { parents: [], spouses: [], children: [] };
    return {
      id,
      data: {
        gender: toFamilyChartGender(person.gender),
        name: person.name,
        years: person.years,
        avatar: person.photo,
        summary: person.summary,
        personPath: person.personPath,
        genderLabel: person.gender
      },
      rels: {
        parents: rels.parents.slice(),
        spouses: rels.spouses.slice(),
        children: rels.children.slice()
      }
    };
  });
}

export function loadTreePayload() {
  const appDataConfig = getDataConfig();
  const templates = APP_CONFIG && APP_CONFIG.templates ? APP_CONFIG.templates : {};
  const fallbackPeopleIndexPath = appDataConfig.peopleIndex || "data/personas-index.json";

  return resolveTreeSources(appDataConfig).then((sources) =>
    Promise.all([
      fetchJson(sources.treeConfigPath),
      loadByIdIndex(sources.peopleIndexPath),
      loadByIdIndex(fallbackPeopleIndexPath)
    ]).then((payload) => {
      const config = payload[0] || {};
      const treeById = payload[1] || {};
      const fallbackById = payload[2] || {};
      const byId = Object.assign({}, fallbackById, treeById);
      const unions = Array.isArray(config.unions) ? config.unions : [];
      const ids = getReferencedIds(unions);

      return loadPersonRecordsById(ids, byId).then((records) => {
        records.forEach((record) => {
          if (!record) {
            return;
          }
          if (record.heroImage && record.heroImage.src) {
            record.heroImage.src = remapImagePath(record.heroImage.src, sources.imagesBase);
          }
          if (Array.isArray(record.gallery)) {
            record.gallery.forEach((image) => {
              if (image && image.src) {
                image.src = remapImagePath(image.src, sources.imagesBase);
              }
            });
          }
        });
        return {
          unions,
          records,
          byId,
          detailTemplate: templates.detail || "persona.html",
          familyData: mapFamilyChartData(unions, byId, records),
          treeKey: sources.treeKey
        };
      });
    })
  );
}
