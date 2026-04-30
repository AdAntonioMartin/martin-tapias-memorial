import { COL_STEP, ROW_STEP, NODE_W, NODE_H } from "./config.js";
import { average } from "./utils.js";
import { sortIdsByBirth } from "./graph.js";

var BASE_GAP = NODE_W + 26;
var PARTNER_GAP = NODE_W + 14;

function computeGenerations(nodes, unionMap) {
  var generation = {};
  Object.keys(nodes).forEach(function (id) {
    generation[id] = nodes[id].parentUnion ? null : 0;
  });

  var changed = true;
  var iter = 0;
  while (changed && iter < 20) {
    changed = false;
    iter += 1;

    Object.keys(unionMap).forEach(function (unionId) {
      var union = unionMap[unionId];
      var parentGens = (union.partners || [])
        .map(function (id) { return generation[id]; })
        .filter(function (value) { return value !== null && value !== undefined; });

      if (!parentGens.length) {
        return;
      }

      var baseGen = Math.max.apply(null, parentGens);
      (union.children || []).forEach(function (childId) {
        var next = baseGen + 2;
        if (generation[childId] === null || generation[childId] < next) {
          generation[childId] = next;
          changed = true;
        }
      });
    });

    Object.keys(unionMap).forEach(function (unionId) {
      var partners = unionMap[unionId].partners || [];
      var values = partners
        .map(function (id) { return generation[id]; })
        .filter(function (value) { return value !== null && value !== undefined; });
      if (!values.length) {
        return;
      }
      var maxGen = Math.max.apply(null, values);
      partners.forEach(function (id) {
        if (generation[id] === null || generation[id] < maxGen) {
          generation[id] = maxGen;
          changed = true;
        }
      });
    });
  }

  Object.keys(generation).forEach(function (id) {
    if (generation[id] === null || generation[id] === undefined) {
      generation[id] = 0;
    }
  });

  return generation;
}

function unionAnchorX(union, position) {
  var points = (union.partners || []).map(function (id) { return position[id]; }).filter(Boolean);
  if (!points.length) {
    return NaN;
  }
  return average(points.map(function (point) { return point.x; }));
}

function getPartnersInRow(personId, idsSet, nodes, unionMap, used) {
  var node = nodes[personId];
  if (!node || !Array.isArray(node.unionIds)) {
    return [];
  }

  var found = {};
  node.unionIds.forEach(function (unionId) {
    var union = unionMap[unionId];
    if (!union || !Array.isArray(union.partners)) {
      return;
    }
    union.partners.forEach(function (candidateId) {
      if (candidateId === personId || !idsSet[candidateId] || used[candidateId]) {
        return;
      }
      found[candidateId] = true;
    });
  });

  return sortIdsByBirth(Object.keys(found), nodes);
}

function estimateDescendantDemand(personId, unionMap, memo, visiting) {
  if (Object.prototype.hasOwnProperty.call(memo, personId)) {
    return memo[personId];
  }
  if (visiting[personId]) {
    return 1;
  }
  visiting[personId] = true;

  var demand = 1;
  Object.keys(unionMap).forEach(function (unionId) {
    var union = unionMap[unionId];
    if (!union || !Array.isArray(union.partners) || !Array.isArray(union.children)) {
      return;
    }
    if (union.partners.indexOf(personId) === -1) {
      return;
    }
    if (!union.children.length) {
      return;
    }
    var branch = union.children.reduce(function (acc, childId) {
      return acc + Math.max(1, estimateDescendantDemand(childId, unionMap, memo, visiting));
    }, 0);
    demand = Math.max(demand, branch);
  });

  delete visiting[personId];
  memo[personId] = demand;
  return demand;
}

function buildGenerationPlan(ids, nodes, unionMap, position, demandMemo) {
  var idsSet = {};
  var used = {};
  var ordered = [];
  var preferredX = {};

  ids.forEach(function (id) {
    idsSet[id] = true;
  });

  var grouped = Object.keys(unionMap).map(function (unionId, index) {
    var union = unionMap[unionId];
    var children = (union.children || []).filter(function (id) { return idsSet[id]; });
    if (!children.length) {
      return null;
    }

    var fallback = {};
    children.forEach(function (id, i) { fallback[id] = i; });
    children = sortIdsByBirth(children, nodes, fallback);

    var units = [];
    children.forEach(function (childId) {
      if (used[childId]) {
        return;
      }

      var members = [childId];
      used[childId] = true;
      getPartnersInRow(childId, idsSet, nodes, unionMap, used).forEach(function (partnerId) {
        members.push(partnerId);
        used[partnerId] = true;
      });

      var demand = estimateDescendantDemand(childId, unionMap, demandMemo, {});
      units.push({
        members: members,
        slots: Math.max(members.length, Math.min(4, Math.ceil(Math.sqrt(demand))))
      });
    });

    if (!units.length) {
      return null;
    }

    return {
      union: union,
      index: index,
      units: units
    };
  }).filter(Boolean);

  grouped.sort(function (a, b) {
    var ax = unionAnchorX(a.union, position);
    var bx = unionAnchorX(b.union, position);
    if (Number.isFinite(ax) && Number.isFinite(bx) && ax !== bx) {
      return ax - bx;
    }
    if (Number.isFinite(ax) && !Number.isFinite(bx)) {
      return -1;
    }
    if (!Number.isFinite(ax) && Number.isFinite(bx)) {
      return 1;
    }
    return a.index - b.index;
  });

  grouped.forEach(function (entry, groupIndex) {
    var anchor = unionAnchorX(entry.union, position);
    if (!Number.isFinite(anchor)) {
      anchor = groupIndex * COL_STEP * 2;
    }

    var totalSlots = entry.units.reduce(function (acc, unit) { return acc + unit.slots; }, 0)
      + Math.max(0, entry.units.length - 1) * 0.25;
    var cursor = -totalSlots / 2;

    entry.units.forEach(function (unit, unitIndex) {
      var center = cursor + unit.slots / 2;
      unit.members.forEach(function (id, memberIndex) {
        preferredX[id] = anchor + (center + memberIndex - (unit.members.length - 1) / 2) * COL_STEP;
        ordered.push(id);
      });
      cursor += unit.slots;
      if (unitIndex < entry.units.length - 1) {
        cursor += 0.25;
      }
    });
  });

  var rest = sortIdsByBirth(ids.filter(function (id) { return !used[id]; }), nodes);
  rest.forEach(function (id, index) {
    preferredX[id] = position[id] ? position[id].x : (ordered.length + index) * COL_STEP;
    ordered.push(id);
  });

  return {
    orderedIds: ordered,
    preferredX: preferredX
  };
}

function arePartners(aId, bId, unionMap) {
  return Object.keys(unionMap).some(function (unionId) {
    var partners = unionMap[unionId].partners || [];
    return partners.indexOf(aId) !== -1 && partners.indexOf(bId) !== -1;
  });
}

function pairMinGap(leftId, rightId, nodes, unionMap, demandMemo, mode) {
  var isDescMode = mode === "descendants";

  if (arePartners(leftId, rightId, unionMap)) {
    return PARTNER_GAP;
  }

  var left = nodes[leftId];
  var right = nodes[rightId];
  if (
    left &&
    right &&
    left.parentUnion &&
    right.parentUnion &&
    left.parentUnion === right.parentUnion
  ) {
    var leftDemand = estimateDescendantDemand(leftId, unionMap, demandMemo, {});
    var rightDemand = estimateDescendantDemand(rightId, unionMap, demandMemo, {});
    var factor = isDescMode ? 0.045 : 0.08;
    var cap = isDescMode ? COL_STEP * 0.35 : COL_STEP * 0.7;
    var extra = Math.min((leftDemand + rightDemand) * COL_STEP * factor, cap);
    return BASE_GAP + extra;
  }

  return BASE_GAP;
}

function placeRow(ids, preferredX, y, position, nodes, unionMap, demandMemo, mode) {
  ids.forEach(function (id, index) {
    if (!position[id]) {
      position[id] = { x: 0, y: y };
    }
    var fallback = (index - (ids.length - 1) / 2) * COL_STEP;
    position[id].x = Object.prototype.hasOwnProperty.call(preferredX, id) ? preferredX[id] : fallback;
    position[id].y = y;
  });

  for (var i = 1; i < ids.length; i += 1) {
    var prevId = ids[i - 1];
    var currId = ids[i];
    var minGap = pairMinGap(prevId, currId, nodes, unionMap, demandMemo, mode);
    var minX = position[prevId].x + minGap;
    if (position[currId].x < minX) {
      position[currId].x = minX;
    }
  }

  var targetCenter = average(ids.map(function (id) {
    return Object.prototype.hasOwnProperty.call(preferredX, id) ? preferredX[id] : position[id].x;
  }));
  if (Number.isFinite(targetCenter)) {
    var currentCenter = average(ids.map(function (id) { return position[id].x; }));
    var delta = targetCenter - currentCenter;
    ids.forEach(function (id) {
      position[id].x += delta;
      position[id].y = y;
    });
  }
}

function refineAncestors(generationKeys, byGeneration, rowIdsByGeneration, nodes, unionMap, position, demandMemo) {
  for (var pass = 0; pass < 3; pass += 1) {
    for (var gi = generationKeys.length - 1; gi >= 0; gi -= 1) {
      var g = generationKeys[gi];
      var ids = rowIdsByGeneration[g] || byGeneration[g] || [];
      if (!ids.length) {
        continue;
      }

      var preferredX = {};
      ids.forEach(function (id) {
        var node = nodes[id];
        var centers = [];
        if (node && Array.isArray(node.unionIds)) {
          node.unionIds.forEach(function (unionId) {
            var union = unionMap[unionId];
            if (!union || (union.partners || []).indexOf(id) === -1) {
              return;
            }
            var childPoints = (union.children || []).map(function (childId) {
              return position[childId];
            }).filter(Boolean);
            if (childPoints.length) {
              centers.push(average(childPoints.map(function (p) { return p.x; })));
            }
          });
        }
        preferredX[id] = centers.length ? average(centers) : position[id].x;
      });

      placeRow(ids, preferredX, gi * ROW_STEP, position, nodes, unionMap, demandMemo, "ancestors");
    }
  }
}

function refineDescendants(generationKeys, rowIdsByGeneration, nodes, unionMap, position, demandMemo) {
  for (var pass = 0; pass < 2; pass += 1) {
    for (var gi = 1; gi < generationKeys.length; gi += 1) {
      var g = generationKeys[gi];
      var ids = rowIdsByGeneration[g] || [];
      if (!ids.length) {
        continue;
      }

      var idsSet = {};
      var preferredX = {};
      ids.forEach(function (id) {
        idsSet[id] = true;
        preferredX[id] = position[id].x;
      });

      Object.keys(unionMap).forEach(function (unionId) {
        var union = unionMap[unionId];
        var siblings = (union.children || []).filter(function (id) { return idsSet[id]; });
        if (!siblings.length) {
          return;
        }

        var center = unionAnchorX(union, position);
        if (!Number.isFinite(center)) {
          return;
        }

        siblings.sort(function (a, b) {
          return ids.indexOf(a) - ids.indexOf(b);
        });

        var blockIds = [];
        var seen = {};
        siblings.forEach(function (childId) {
          if (!seen[childId]) {
            blockIds.push(childId);
            seen[childId] = true;
          }
          getPartnersInRow(childId, idsSet, nodes, unionMap, seen).forEach(function (partnerId) {
            blockIds.push(partnerId);
            seen[partnerId] = true;
          });
        });

        if (!blockIds.length) {
          return;
        }

        var blockCenter = average(blockIds.map(function (id) { return position[id].x; }));
        var delta = center - blockCenter;
        blockIds.forEach(function (id) {
          preferredX[id] = position[id].x + delta;
        });
      });

      placeRow(ids, preferredX, gi * ROW_STEP, position, nodes, unionMap, demandMemo, "descendants");
    }
  }
}

export function computeLayout(graph) {
  var nodes = graph.nodes;
  var unionMap = graph.unionMap;
  var generation = computeGenerations(nodes, unionMap);
  var byGeneration = {};
  var demandMemo = {};

  Object.keys(generation).forEach(function (id) {
    var g = generation[id];
    if (!byGeneration[g]) {
      byGeneration[g] = [];
    }
    byGeneration[g].push(id);
  });

  var generationKeys = Object.keys(byGeneration).map(Number).sort(function (a, b) { return a - b; });
  var position = {};
  var rowIdsByGeneration = {};

  generationKeys.forEach(function (g, rowIndex) {
    var ids = byGeneration[g];
    var plan = buildGenerationPlan(ids, nodes, unionMap, position, demandMemo);
    rowIdsByGeneration[g] = plan.orderedIds.slice();
    placeRow(plan.orderedIds, plan.preferredX, rowIndex * ROW_STEP, position, nodes, unionMap, demandMemo, "initial");
  });

  refineAncestors(generationKeys, byGeneration, rowIdsByGeneration, nodes, unionMap, position, demandMemo);
  refineDescendants(generationKeys, rowIdsByGeneration, nodes, unionMap, position, demandMemo);

  var unionPos = {};
  Object.keys(unionMap).forEach(function (unionId) {
    var union = unionMap[unionId];
    var partnerPoints = (union.partners || []).map(function (id) {
      return position[id];
    }).filter(Boolean);
    if (!partnerPoints.length) {
      return;
    }

    unionPos[unionId] = {
      x: average(partnerPoints.map(function (p) { return p.x; })),
      y: average(partnerPoints.map(function (p) { return p.y; }))
    };
  });

  return {
    pos: position,
    unionPos: unionPos,
    size: {
      nodeW: NODE_W,
      nodeH: NODE_H
    }
  };
}
