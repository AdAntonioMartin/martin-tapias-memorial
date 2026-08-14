/**
 * Recorte del arbol alrededor de una persona.
 *
 * Al enfocar a alguien no se dibuja el grafo entero: se muestran sus ascendientes,
 * todos los descendientes de esos ascendientes, las parejas de esa sangre y las
 * ramas de sus hermanos. Esta logica vivia dentro de js/arbol.js, que mezclaba
 * el recorrido del grafo con el manejo del DOM y de la libreria.
 */

function parentsOf(model, id) {
  const person = model.people.get(id);
  return person ? person.parents : [];
}

function childrenOf(model, id) {
  const person = model.people.get(id);
  return person ? person.children : [];
}

function collectAncestorIds(model, mainId) {
  const ancestors = new Set();
  if (!model.people.has(mainId)) {
    return ancestors;
  }

  const queue = [mainId];
  while (queue.length) {
    const currentId = queue.shift();
    parentsOf(model, currentId).forEach((parentId) => {
      if (!ancestors.has(parentId) && model.people.has(parentId)) {
        ancestors.add(parentId);
        queue.push(parentId);
      }
    });
  }
  return ancestors;
}

function collectDescendantIds(model, seedIds) {
  const descendants = new Set();
  const queue = seedIds.filter((id) => model.people.has(id));
  queue.forEach((id) => descendants.add(id));

  while (queue.length) {
    const currentId = queue.shift();
    childrenOf(model, currentId).forEach((childId) => {
      if (!descendants.has(childId) && model.people.has(childId)) {
        descendants.add(childId);
        queue.push(childId);
      }
    });
  }
  return descendants;
}

function collectBloodFamilyIds(model, mainId) {
  if (!model.people.has(mainId)) {
    return new Set();
  }
  const ancestorIds = collectAncestorIds(model, mainId);
  const bloodIds = collectDescendantIds(model, [mainId, ...ancestorIds]);
  ancestorIds.forEach((id) => bloodIds.add(id));
  return bloodIds;
}

function addWithSpouses(included, model, personId) {
  const person = model.people.get(personId);
  if (!person) {
    return;
  }
  included.add(personId);
  person.spouses.forEach((spouseId) => {
    if (model.people.has(spouseId)) {
      included.add(spouseId);
    }
  });
}

function includeSiblingBranches(included, model, mainId) {
  if (!model.people.has(mainId)) {
    return;
  }

  const siblingIds = new Set();
  parentsOf(model, mainId).forEach((parentId) => {
    childrenOf(model, parentId).forEach((childId) => {
      if (childId !== mainId && model.people.has(childId)) {
        siblingIds.add(childId);
      }
    });
  });

  siblingIds.forEach((siblingId) => {
    addWithSpouses(included, model, siblingId);
    childrenOf(model, siblingId).forEach((childId) => {
      if (model.people.has(childId)) {
        included.add(childId);
      }
    });
  });
}

/** Conjunto de identificadores visibles al enfocar a `mainId`. */
export function collectScopeIds(model, mainId) {
  const bloodIds = collectBloodFamilyIds(model, mainId);
  if (!bloodIds.size) {
    return null;
  }

  const included = new Set(bloodIds);
  bloodIds.forEach((id) => addWithSpouses(included, model, id));
  includeSiblingBranches(included, model, mainId);
  return included;
}

/**
 * Recorta unos datos ya en formato family-chart a las personas de `scopeIds`,
 * podando tambien las relaciones que apunten fuera del recorte.
 */
export function scopeFamilyChartData(familyData, scopeIds) {
  if (!scopeIds) {
    return familyData.map(cloneEntry);
  }

  const keep = (ids) => ids.filter((id) => scopeIds.has(id));
  return familyData
    .filter((person) => scopeIds.has(person.id))
    .map((person) => ({
      id: person.id,
      data: { ...person.data },
      rels: {
        parents: keep(person.rels.parents),
        spouses: keep(person.rels.spouses),
        children: keep(person.rels.children)
      }
    }));
}

function cloneEntry(person) {
  return {
    id: person.id,
    data: { ...person.data },
    rels: {
      parents: person.rels.parents.slice(),
      spouses: person.rels.spouses.slice(),
      children: person.rels.children.slice()
    }
  };
}
