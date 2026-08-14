import { formatYears } from "./format.js";

/**
 * Representacion unica del arbol.
 *
 * Antes habia dos: `buildGraph` alimentaba el panel lateral y
 * `mapFamilyChartData` alimentaba la libreria, recorriendo las mismas uniones
 * para construir estructuras casi identicas con valores por defecto distintos.
 * Aqui se construye una sola vez y `toFamilyChartData` la adapta al formato
 * que espera family-chart.
 *
 * La entrada es el mapa `people` de data/tree-bundle.json: un objeto plano por
 * persona con lo justo para pintar una tarjeta.
 */

function normalizeGender(gender) {
  return gender === "male" || gender === "female" ? gender : "unknown";
}

function titleFromId(id) {
  return String(id || "")
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function sanitizeUnion(union) {
  return {
    id: union.id,
    partners: Array.isArray(union.partners) ? union.partners.filter(Boolean) : [],
    children: Array.isArray(union.children) ? union.children.filter(Boolean) : [],
    type: union.type || "married",
    married: union.married || null
  };
}

function createPerson(id, source) {
  return {
    id,
    name: (source && source.name) || titleFromId(id),
    years: formatYears(source),
    gender: normalizeGender(source && source.gender),
    photo: (source && source.thumb) || "",
    summary: (source && source.summary) || "",
    personPath: (source && source.path) || "",
    /** Union de la que esta persona es hija, si se conoce. */
    parentUnionId: null,
    /** Uniones en las que participa como pareja. */
    unionIds: [],
    parents: [],
    spouses: [],
    children: []
  };
}

function addUnique(list, value) {
  if (value && !list.includes(value)) {
    list.push(value);
  }
}

/**
 * @param {Array} unions   uniones tal cual vienen del JSON
 * @param {Object} peopleById mapa id -> datos de tarjeta
 * @returns {{people: Map, unions: Map, order: string[], missingIds: string[]}}
 */
export function buildTreeModel(unions, peopleById) {
  const sources = peopleById || {};
  const people = new Map();
  const unionMap = new Map();
  const order = [];
  const missingIds = [];

  const ensurePerson = (id) => {
    if (!people.has(id)) {
      if (!sources[id]) {
        missingIds.push(id);
      }
      people.set(id, createPerson(id, sources[id]));
      order.push(id);
    }
    return people.get(id);
  };

  (Array.isArray(unions) ? unions : []).forEach((rawUnion) => {
    if (!rawUnion || !rawUnion.id) {
      console.error("tree: union sin id, se ignora", rawUnion);
      return;
    }
    const union = sanitizeUnion(rawUnion);
    unionMap.set(union.id, union);

    union.partners.forEach((id) => addUnique(ensurePerson(id).unionIds, union.id));
    union.children.forEach((id) => {
      ensurePerson(id).parentUnionId = union.id;
    });

    union.partners.forEach((partnerId) => {
      const partner = people.get(partnerId);
      union.partners.forEach((spouseId) => {
        if (spouseId !== partnerId) {
          addUnique(partner.spouses, spouseId);
        }
      });
      union.children.forEach((childId) => {
        addUnique(partner.children, childId);
        addUnique(people.get(childId).parents, partnerId);
      });
    });
  });

  if (missingIds.length) {
    console.warn(`tree: ${missingIds.length} personas referenciadas sin datos`, missingIds);
  }

  return { people, unions: unionMap, order, missingIds };
}

/**
 * family-chart solo entiende "M" y "F". El genero desconocido se representa
 * como "M" a efectos de colocacion interna; la tarjeta que se pinta usa
 * `genderLabel`, asi que visualmente sigue saliendo como sin genero.
 */
function toFamilyChartGender(gender) {
  return gender === "female" ? "F" : "M";
}

export function toFamilyChartData(model) {
  return model.order.map((id) => {
    const person = model.people.get(id);
    return {
      id,
      data: {
        gender: toFamilyChartGender(person.gender),
        genderLabel: person.gender,
        name: person.name,
        years: person.years,
        avatar: person.photo,
        summary: person.summary,
        personPath: person.personPath
      },
      rels: {
        parents: person.parents.slice(),
        spouses: person.spouses.slice(),
        children: person.children.slice()
      }
    };
  });
}
