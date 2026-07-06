import { getLaunchTarget, loadTreePayload } from "./tree/data.js";
import { buildGraph } from "./tree/graph.js";
import { closePanel, openPanel } from "./tree/panel.js";
import { applyAppTheme } from "./core/theme.js";
import { APP_CONFIG } from "./config/app-config.js";
import { escapeHtml } from "./core/html.js";
import { applyI18nToDom, loadUiText, t } from "./core/i18n.js";
import { normalizeDataPath } from "./core/url.js";

function familyChartApi() {
  return window.f3 || null;
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function cardGenderClass(person) {
  if (person.genderLabel === "male") {
    return "card-male";
  }
  if (person.genderLabel === "female") {
    return "card-female";
  }
  return "card-genderless";
}

function avatarFallback(person) {
  if (person.genderLabel === "male") {
    return "M";
  }
  if (person.genderLabel === "female") {
    return "F";
  }
  return "?";
}

function cardHtml(person, isMain) {
  var classes = ["card", "tree-node-card", cardGenderClass(person)];
  if (isMain) {
    classes.push("card-main");
  }
  var avatar = person.avatar
    ? '<img src="' + escapeHtml(person.avatar) + '" alt="' + escapeHtml(person.name || "") + '">'
    : '<span class="tree-node-avatar-fallback">' + escapeHtml(avatarFallback(person)) + "</span>";
  return (
    '<div class="' + classes.join(" ") + '">' +
      '<div class="card-inner tree-node-card__inner">' +
        '<div class="tree-node-avatar">' + avatar + "</div>" +
        '<div class="tree-node-name">' + escapeHtml(person.name || "") + "</div>" +
        '<div class="tree-node-years">' + escapeHtml(person.years || "") + "</div>" +
      "</div>" +
    "</div>"
  );
}

function bindToolbar(chart, f3Api) {
  var treeConfig = APP_CONFIG && APP_CONFIG.tree ? APP_CONFIG.tree : {};
  var zoomStep = treeConfig.zoomStep || 1.15;
  var zoomTransitionMs = treeConfig.zoomTransitionMs || 220;
  var zoomIn = document.getElementById("btn-zoom-in");
  var zoomOut = document.getElementById("btn-zoom-out");
  var fitBtn = document.getElementById("btn-fit");

  if (zoomIn) {
    zoomIn.addEventListener("click", function () {
      f3Api.handlers.manualZoom({
        amount: zoomStep,
        svg: chart.svg,
        transition_time: zoomTransitionMs
      });
    });
  }
  if (zoomOut) {
    zoomOut.addEventListener("click", function () {
      f3Api.handlers.manualZoom({
        amount: 1 / zoomStep,
        svg: chart.svg,
        transition_time: zoomTransitionMs
      });
    });
  }
  if (fitBtn) {
    fitBtn.addEventListener("click", function () {
      chart.updateTree({
        initial: false,
        tree_position: "fit"
      });
    });
  }
}

function buildFamilyIndex(familyData) {
  var byId = {};
  var parentsById = {};
  var childrenById = {};
  (Array.isArray(familyData) ? familyData : []).forEach(function (person) {
    if (!person || !person.id) {
      return;
    }
    byId[person.id] = person;
    parentsById[person.id] = [];
    childrenById[person.id] = [];
  });

  Object.keys(byId).forEach(function (id) {
    var rels = byId[id] && byId[id].rels ? byId[id].rels : {};
    var parents = Array.isArray(rels.parents) ? rels.parents : [];
    var children = Array.isArray(rels.children) ? rels.children : [];

    parents.forEach(function (parentId) {
      if (!byId[parentId]) {
        return;
      }
      parentsById[id].push(parentId);
    });
    children.forEach(function (childId) {
      if (!byId[childId]) {
        return;
      }
      childrenById[id].push(childId);
    });
  });

  return {
    byId: byId,
    parentsById: parentsById,
    childrenById: childrenById
  };
}

function collectAncestorIds(mainId, familyIndex) {
  var byId = familyIndex && familyIndex.byId ? familyIndex.byId : {};
  var parentsById = familyIndex && familyIndex.parentsById ? familyIndex.parentsById : {};
  if (!mainId || !byId[mainId]) {
    return {};
  }

  var ancestors = {};
  var queue = [mainId];

  while (queue.length) {
    var currentId = queue.shift();
    var parents = Array.isArray(parentsById[currentId]) ? parentsById[currentId] : [];
    parents.forEach(function (parentId) {
      if (!ancestors[parentId] && byId[parentId]) {
        ancestors[parentId] = true;
        queue.push(parentId);
      }
    });
  }

  return ancestors;
}

function collectDescendantIds(seedIds, familyIndex) {
  var byId = familyIndex && familyIndex.byId ? familyIndex.byId : {};
  var childrenById = familyIndex && familyIndex.childrenById ? familyIndex.childrenById : {};
  var descendants = {};
  var queue = (Array.isArray(seedIds) ? seedIds : []).filter(function (id) {
    return !!byId[id];
  });

  queue.forEach(function (id) {
    descendants[id] = true;
  });

  while (queue.length) {
    var currentId = queue.shift();
    var children = Array.isArray(childrenById[currentId]) ? childrenById[currentId] : [];
    children.forEach(function (childId) {
      if (!descendants[childId] && byId[childId]) {
        descendants[childId] = true;
        queue.push(childId);
      }
    });
  }

  return descendants;
}

function collectBloodFamilyIds(mainId, familyIndex) {
  var byId = familyIndex && familyIndex.byId ? familyIndex.byId : {};
  if (!mainId || !byId[mainId]) {
    return {};
  }
  var ancestorIds = collectAncestorIds(mainId, familyIndex);
  var seedIds = [mainId].concat(Object.keys(ancestorIds));
  var bloodIds = collectDescendantIds(seedIds, familyIndex);

  Object.keys(ancestorIds).forEach(function (id) {
    bloodIds[id] = true;
  });

  return bloodIds;
}

function buildScopedFamilyData(familyData, familyIndex, mainId) {
  var byId = familyIndex && familyIndex.byId ? familyIndex.byId : {};
  var bloodIds = collectBloodFamilyIds(mainId, familyIndex);
  if (!Object.keys(bloodIds).length) {
    return {
      data: Array.isArray(familyData) ? cloneData(familyData) : [],
      renderMainId: mainId
    };
  }

  var included = {};
  Object.keys(bloodIds).forEach(function (id) {
    included[id] = true;
  });

  Object.keys(bloodIds).forEach(function (id) {
    var rels = byId[id] && byId[id].rels ? byId[id].rels : {};
    var spouses = Array.isArray(rels.spouses) ? rels.spouses : [];
    spouses.forEach(function (spouseId) {
      if (byId[spouseId]) {
        included[spouseId] = true;
      }
    });
  });

  var scopedData = (Array.isArray(familyData) ? familyData : [])
    .filter(function (person) {
      return person && person.id && included[person.id];
    })
    .map(function (person) {
      var rels = person && person.rels ? person.rels : {};
      var filterIds = function (ids) {
        return (Array.isArray(ids) ? ids : []).filter(function (id) {
          return !!included[id];
        });
      };

      return {
        id: person.id,
        data: person.data,
        rels: {
          parents: filterIds(rels.parents),
          spouses: filterIds(rels.spouses),
          children: filterIds(rels.children)
        }
      };
    });

  return {
    data: cloneData(scopedData),
    renderMainId: mainId
  };
}

function pickDefaultMainId(target, graph, familyData) {
  if (target.id && graph.nodes[target.id]) {
    return target.id;
  }

  if (target.dataPath) {
    var byPathId = Object.keys(graph.nodes).find(function (nodeId) {
      return normalizeDataPath(graph.nodes[nodeId].personPath) === target.dataPath;
    });
    if (byPathId) {
      return byPathId;
    }
  }

  if (!Array.isArray(familyData) || !familyData.length) {
    return "";
  }
  return familyData[0].id || "";
}

function hasValidLaunchTarget(target, graph) {
  if (target.id && graph.nodes[target.id]) {
    return true;
  }

  if (!target.dataPath) {
    return false;
  }

  return Object.keys(graph.nodes).some(function (nodeId) {
    return normalizeDataPath(graph.nodes[nodeId].personPath) === target.dataPath;
  });
}

function init() {
  var f3Api = familyChartApi();
  if (!f3Api) {
    console.error("arbol.js: family-chart no disponible en window.f3");
    var libError = document.getElementById("tree-error");
    if (libError) {
      libError.textContent = t("tree.messages.error", "No se pudo cargar el arbol genealogico.");
      libError.hidden = false;
    }
    return;
  }

  var loading = document.getElementById("tree-loading");
  var error = document.getElementById("tree-error");
  var target = getLaunchTarget();
  var selectedId = "";

  loadTreePayload()
    .then(function (payload) {
      var graph = buildGraph(payload.unions, payload.records, payload.byId);
      var treeConfig = APP_CONFIG && APP_CONFIG.tree ? APP_CONFIG.tree : {};
      var container = document.getElementById("tree-canvas");
      if (!container) {
        throw new Error("No existe #tree-canvas");
      }
      var baseFamilyData = Array.isArray(payload.familyData) ? cloneData(payload.familyData) : [];
      var familyIndex = buildFamilyIndex(baseFamilyData);
      var defaultMainId = pickDefaultMainId(target, graph, baseFamilyData);
      var opensFromTarget = hasValidLaunchTarget(target, graph);

      var chart = f3Api.createChart(container, cloneData(baseFamilyData))
        .setTransitionTime(treeConfig.transitionMs || 420)
        .setCardXSpacing(treeConfig.cardSpacing && treeConfig.cardSpacing.x ? treeConfig.cardSpacing.x : 200)
        .setCardYSpacing(treeConfig.cardSpacing && treeConfig.cardSpacing.y ? treeConfig.cardSpacing.y : 140)
        .setShowSiblingsOfMain(true)
        .setSingleParentEmptyCard(false);

      var card = chart.setCardHtml()
        .setStyle("imageRect")
        .setCardImageField("avatar")
        .setCardDisplay([
          function (datum) { return datum.name || ""; },
          function (datum) { return datum.years || ""; }
        ])
        .setCardDim(treeConfig.cardDim || {});

      card.setCardInnerHtmlCreator(function (treeDatum) {
        return cardHtml(treeDatum.data.data, treeDatum.data.main);
      });

      function applySelectedState() {
        document.querySelectorAll(".tree-node-card--selected").forEach(function (el) {
          el.classList.remove("tree-node-card--selected");
        });
        if (!selectedId) {
          return;
        }
        document.querySelectorAll(".card_cont[data-pid='" + selectedId + "'] .tree-node-card").forEach(function (el) {
          el.classList.add("tree-node-card--selected");
        });
      }

      function focusPerson(personId, options) {
        if (!personId || !graph.nodes[personId]) {
          return;
        }
        var opts = options || {};
        selectedId = personId;
        var scoped = buildScopedFamilyData(baseFamilyData, familyIndex, personId);
        chart.setShowSiblingsOfMain(true);
        chart.updateData(scoped.data);
        chart.updateMainId(scoped.renderMainId || personId);
        chart.updateTree({
          initial: !!opts.initial,
          tree_position: opts.treePosition || "fit"
        });
        applySelectedState();
        if (!opts.skipPanel) {
          openPanel(personId, graph, payload.detailTemplate, function (nodeId) {
            focusPerson(nodeId, {
              treePosition: "fit"
            });
          });
        }
      }

      card.setOnCardClick(function (event, treeDatum) {
        event.stopPropagation();
        focusPerson(treeDatum.data.id);
      });

      card.setOnCardUpdate(function (treeDatum) {
        this.dataset.pid = treeDatum.data.id;
        applySelectedState();
      });

      if (loading) {
        loading.remove();
      }

      if (defaultMainId) {
        focusPerson(defaultMainId, {
          initial: true,
          treePosition: "fit",
          skipPanel: !opensFromTarget
        });
      } else {
        chart.updateTree({
          initial: true,
          tree_position: "fit"
        });
      }

      bindToolbar(chart, f3Api);
      applySelectedState();

      var closeBtn = document.getElementById("tree-panel-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", function () {
          selectedId = "";
          applySelectedState();
          closePanel();
        });
      }

      var wrapper = document.getElementById("tree-wrapper");
      if (wrapper) {
        wrapper.addEventListener("click", function (event) {
          if (!event.target.closest(".tree-node-card") && !event.target.closest(".tree-panel")) {
            selectedId = "";
            applySelectedState();
            closePanel();
          }
        });
      }
    })
    .catch(function (err) {
      console.error("arbol.js:", err);
      if (loading) {
        loading.remove();
      }
      if (error) {
        error.hidden = false;
      }
    });
}

applyAppTheme();
document.addEventListener("DOMContentLoaded", function () {
  loadUiText().then(function () {
    applyI18nToDom(document);
    init();
  });
});
