import { formatYears } from "./format.js";

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
  const nodes = {};
  const unionMap = {};
  const recordById = {};

  records.forEach((record) => {
    if (record && record.id) {
      recordById[record.id] = record;
    }
    if (record && record.__id && !recordById[record.__id]) {
      recordById[record.__id] = record;
    }
  });

  (Array.isArray(unions) ? unions : []).forEach((rawUnion) => {
    if (!rawUnion || !rawUnion.id) {
      return;
    }
    const union = sanitizeUnion(rawUnion);
    unionMap[union.id] = union;

    union.partners.forEach((id) => {
      if (!nodes[id]) {
        const rec = recordById[id] || null;
        nodes[id] = {
          id,
          record: rec,
          name: rec ? rec.name || id : id,
          years: rec ? formatYears(rec) : "",
          photo: rec && rec.heroImage ? rec.heroImage.src : null,
          gender: rec && rec.gender ? rec.gender : "unknown",
          personPath: rec ? rec.__path : byId[id] || null,
          parentUnion: null,
          unionIds: []
        };
      }
      nodes[id].unionIds.push(union.id);
    });

    union.children.forEach((id) => {
      if (!nodes[id]) {
        const childRec = recordById[id] || null;
        nodes[id] = {
          id,
          record: childRec,
          name: childRec ? childRec.name || id : id,
          years: childRec ? formatYears(childRec) : "",
          photo: childRec && childRec.heroImage ? childRec.heroImage.src : null,
          gender: childRec && childRec.gender ? childRec.gender : "unknown",
          personPath: childRec ? childRec.__path : byId[id] || null,
          parentUnion: null,
          unionIds: []
        };
      }
      nodes[id].parentUnion = union.id;
    });
  });

  return {
    nodes,
    unionMap
  };
}
