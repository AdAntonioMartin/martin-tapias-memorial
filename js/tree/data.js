import { APP_CONFIG } from "../config/app-config.js";
import { fetchJson } from "../core/net.js";
import { normalizeDataPath } from "../core/url.js";
import { getFactValue } from "../core/person.js";

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

function extractYear(value) {
  var text = String(value || "").trim();
  if (!text) {
    return "";
  }
  var slash = text.match(/\/(\d{4})$/);
  if (slash) {
    return slash[1];
  }
  var plain = text.match(/\b(\d{4})\b/);
  return plain ? plain[1] : "";
}

function formatYears(record) {
  if (!record) {
    return "";
  }
  var born = getFactValue(record, "Nacimiento") || record.born || "";
  var died = getFactValue(record, "Fallecimiento") || record.died || "";
  var bornYear = extractYear(born);
  var diedYear = extractYear(died);
  if (!bornYear && !diedYear) {
    return "";
  }
  if (bornYear && diedYear) {
    return bornYear + " - " + diedYear;
  }
  return bornYear ? "n. " + bornYear : "+ " + diedYear;
}

function titleFromId(id) {
  return String(id || "")
    .split("-")
    .filter(Boolean)
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
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

function getOrCreatePerson(nodesById, id, byId, recordById) {
  if (!nodesById[id]) {
    var record = recordById[id] || null;
    var gender = normalizeGender(record && record.gender);
    var name = record && record.name ? record.name : titleFromId(id);
    var years = formatYears(record);
    var photo = record && record.heroImage ? record.heroImage.src : "";
    var personPath = record && record.__path ? record.__path : (byId[id] || "");
    nodesById[id] = {
      id: id,
      name: name,
      years: years,
      gender: gender,
      personPath: personPath,
      photo: photo,
      summary: record && record.summary ? record.summary : "",
      record: record
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
  var recordById = {};
  var nodesById = {};
  var relsById = {};

  records.forEach(function (record) {
    if (record && record.__id) {
      recordById[record.__id] = record;
    }
    if (record && record.id) {
      recordById[record.id] = record;
    }
  });

  (Array.isArray(unions) ? unions : []).forEach(function (union) {
    var partners = Array.isArray(union.partners) ? union.partners.filter(Boolean) : [];
    var children = Array.isArray(union.children) ? union.children.filter(Boolean) : [];

    partners.forEach(function (id) {
      getOrCreatePerson(nodesById, id, byId, recordById);
      if (!relsById[id]) {
        relsById[id] = { parents: [], spouses: [], children: [] };
      }
    });
    children.forEach(function (id) {
      getOrCreatePerson(nodesById, id, byId, recordById);
      if (!relsById[id]) {
        relsById[id] = { parents: [], spouses: [], children: [] };
      }
    });

    partners.forEach(function (partnerId) {
      partners.forEach(function (spouseId) {
        if (spouseId !== partnerId) {
          addRel(relsById[partnerId], "spouses", spouseId);
        }
      });
      children.forEach(function (childId) {
        addRel(relsById[partnerId], "children", childId);
      });
    });

    children.forEach(function (childId) {
      partners.forEach(function (parentId) {
        addRel(relsById[childId], "parents", parentId);
      });
    });
  });

  return Object.keys(nodesById).map(function (id) {
    var person = nodesById[id];
    var rels = relsById[id] || { parents: [], spouses: [], children: [] };
    return {
      id: id,
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
  var appDataConfig = APP_CONFIG && APP_CONFIG.data ? APP_CONFIG.data : {};
  var treeConfigPath = appDataConfig.treeConfig || "data/arbol.json";
  var peopleIndexPath = appDataConfig.peopleIndex || "data/personas-index.json";
  var templates = APP_CONFIG && APP_CONFIG.templates ? APP_CONFIG.templates : {};

  return Promise.all([
    fetchJson(treeConfigPath),
    fetchJson(peopleIndexPath).catch(function () { return { byId: {} }; })
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
        detailTemplate: templates.detail || "persona.html",
        familyData: mapFamilyChartData(unions, byId, records)
      };
    });
  });
}
