import { GENDER_EMOJI } from "./config.js";
import { parseDateByFormat } from "./utils.js";
import { getFactValue } from "../core/person.js";

export { GENDER_EMOJI };

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

function birthSortValue(node) {
  if (!node || !node.record) {
    return Number.POSITIVE_INFINITY;
  }
  var birth = getFactValue(node.record, "Nacimiento") || node.record.born || "";
  var value = parseDateByFormat(birth, "dd/mm/yyyy");
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
}

function sanitizeUnion(union) {
  return {
    id: union.id,
    partners: Array.isArray(union.partners) ? union.partners.slice() : [],
    children: Array.isArray(union.children) ? union.children.slice() : [],
    type: union.type || "married",
    married: union.married || null
  };
}

export function buildGraph(unions, records, byId) {
  var nodes = {};
  var unionMap = {};
  var recordById = {};

  records.forEach(function (record) {
    if (record && record.id) {
      recordById[record.id] = record;
    }
    if (record && record.__id && !recordById[record.__id]) {
      recordById[record.__id] = record;
    }
  });

  (Array.isArray(unions) ? unions : []).forEach(function (rawUnion) {
    if (!rawUnion || !rawUnion.id) {
      return;
    }
    var union = sanitizeUnion(rawUnion);
    unionMap[union.id] = union;

    union.partners.forEach(function (id) {
      if (!nodes[id]) {
        var rec = recordById[id] || null;
        nodes[id] = {
          id: id,
          record: rec,
          name: rec ? (rec.name || id) : id,
          years: rec ? formatYears(rec) : "",
          photo: rec && rec.heroImage ? rec.heroImage.src : null,
          gender: rec && rec.gender ? rec.gender : "unknown",
          personPath: rec ? rec.__path : (byId[id] || null),
          parentUnion: null,
          unionIds: []
        };
      }
      nodes[id].unionIds.push(union.id);
    });

    union.children.forEach(function (id) {
      if (!nodes[id]) {
        var childRec = recordById[id] || null;
        nodes[id] = {
          id: id,
          record: childRec,
          name: childRec ? (childRec.name || id) : id,
          years: childRec ? formatYears(childRec) : "",
          photo: childRec && childRec.heroImage ? childRec.heroImage.src : null,
          gender: childRec && childRec.gender ? childRec.gender : "unknown",
          personPath: childRec ? childRec.__path : (byId[id] || null),
          parentUnion: null,
          unionIds: []
        };
      }
      nodes[id].parentUnion = union.id;
    });
  });

  return {
    nodes: nodes,
    unionMap: unionMap
  };
}

export function sortIdsByBirth(ids, nodes, fallbackOrder) {
  return ids.slice().sort(function (a, b) {
    var av = birthSortValue(nodes[a]);
    var bv = birthSortValue(nodes[b]);
    if (av !== bv) {
      return av - bv;
    }

    if (fallbackOrder) {
      var ai = Object.prototype.hasOwnProperty.call(fallbackOrder, a) ? fallbackOrder[a] : Number.MAX_SAFE_INTEGER;
      var bi = Object.prototype.hasOwnProperty.call(fallbackOrder, b) ? fallbackOrder[b] : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) {
        return ai - bi;
      }
    }

    var aName = nodes[a] ? nodes[a].name : a;
    var bName = nodes[b] ? nodes[b].name : b;
    return String(aName).localeCompare(String(bName), "es", { sensitivity: "base" });
  });
}
