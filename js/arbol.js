import { getLaunchTarget, loadTreePayload } from "./tree/data.js";
import { buildGraph } from "./tree/graph.js";
import { closePanel, openPanel } from "./tree/panel.js";
import { APP_CONFIG } from "./config/app-config.js";
import { escapeHtml } from "./core/html.js";
import { t } from "./core/i18n.js";
import { normalizeDataPath } from "./core/url.js";
import { bootstrapPage } from "./core/bootstrap.js";

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
  const classes = ["card", "tree-node-card", cardGenderClass(person)];
  if (isMain) {
    classes.push("card-main");
  }
  const avatar = person.avatar
    ? `<img src="${escapeHtml(person.avatar)}" alt="${escapeHtml(person.name || "")}">`
    : `<span class="tree-node-avatar-fallback">${escapeHtml(avatarFallback(person))}</span>`;
  return (
    `<div class="${classes.join(" ")}">` +
    '<div class="card-inner tree-node-card__inner">' +
    `<div class="tree-node-avatar">${avatar}</div>` +
    `<div class="tree-node-name">${escapeHtml(person.name || "")}</div>` +
    `<div class="tree-node-years">${escapeHtml(person.years || "")}</div>` +
    "</div>" +
    "</div>"
  );
}

function bindToolbar(chart, f3Api) {
  const treeConfig = APP_CONFIG && APP_CONFIG.tree ? APP_CONFIG.tree : {};
  const zoomStep = treeConfig.zoomStep || 1.15;
  const zoomTransitionMs = treeConfig.zoomTransitionMs || 220;
  const zoomIn = document.getElementById("btn-zoom-in");
  const zoomOut = document.getElementById("btn-zoom-out");
  const fitBtn = document.getElementById("btn-fit");

  if (zoomIn) {
    zoomIn.addEventListener("click", () => {
      f3Api.handlers.manualZoom({
        amount: zoomStep,
        svg: chart.svg,
        transition_time: zoomTransitionMs
      });
    });
  }
  if (zoomOut) {
    zoomOut.addEventListener("click", () => {
      f3Api.handlers.manualZoom({
        amount: 1 / zoomStep,
        svg: chart.svg,
        transition_time: zoomTransitionMs
      });
    });
  }
  if (fitBtn) {
    fitBtn.addEventListener("click", () => {
      chart.updateTree({
        initial: false,
        tree_position: "fit"
      });
    });
  }
}

function buildFamilyIndex(familyData) {
  const byId = {};
  const parentsById = {};
  const childrenById = {};
  (Array.isArray(familyData) ? familyData : []).forEach((person) => {
    if (!person || !person.id) {
      return;
    }
    byId[person.id] = person;
    parentsById[person.id] = [];
    childrenById[person.id] = [];
  });

  Object.keys(byId).forEach((id) => {
    const rels = byId[id] && byId[id].rels ? byId[id].rels : {};
    const parents = Array.isArray(rels.parents) ? rels.parents : [];
    const children = Array.isArray(rels.children) ? rels.children : [];

    parents.forEach((parentId) => {
      if (!byId[parentId]) {
        return;
      }
      parentsById[id].push(parentId);
    });
    children.forEach((childId) => {
      if (!byId[childId]) {
        return;
      }
      childrenById[id].push(childId);
    });
  });

  return {
    byId,
    parentsById,
    childrenById
  };
}

function collectAncestorIds(mainId, familyIndex) {
  const byId = familyIndex && familyIndex.byId ? familyIndex.byId : {};
  const parentsById = familyIndex && familyIndex.parentsById ? familyIndex.parentsById : {};
  if (!mainId || !byId[mainId]) {
    return {};
  }

  const ancestors = {};
  const queue = [mainId];

  while (queue.length) {
    const currentId = queue.shift();
    const parents = Array.isArray(parentsById[currentId]) ? parentsById[currentId] : [];
    parents.forEach((parentId) => {
      if (!ancestors[parentId] && byId[parentId]) {
        ancestors[parentId] = true;
        queue.push(parentId);
      }
    });
  }

  return ancestors;
}

function collectDescendantIds(seedIds, familyIndex) {
  const byId = familyIndex && familyIndex.byId ? familyIndex.byId : {};
  const childrenById = familyIndex && familyIndex.childrenById ? familyIndex.childrenById : {};
  const descendants = {};
  const queue = (Array.isArray(seedIds) ? seedIds : []).filter((id) => !!byId[id]);

  queue.forEach((id) => {
    descendants[id] = true;
  });

  while (queue.length) {
    const currentId = queue.shift();
    const children = Array.isArray(childrenById[currentId]) ? childrenById[currentId] : [];
    children.forEach((childId) => {
      if (!descendants[childId] && byId[childId]) {
        descendants[childId] = true;
        queue.push(childId);
      }
    });
  }

  return descendants;
}

function collectBloodFamilyIds(mainId, familyIndex) {
  const byId = familyIndex && familyIndex.byId ? familyIndex.byId : {};
  if (!mainId || !byId[mainId]) {
    return {};
  }
  const ancestorIds = collectAncestorIds(mainId, familyIndex);
  const seedIds = [mainId].concat(Object.keys(ancestorIds));
  const bloodIds = collectDescendantIds(seedIds, familyIndex);

  Object.keys(ancestorIds).forEach((id) => {
    bloodIds[id] = true;
  });

  return bloodIds;
}

function addPersonAndSpouses(included, personId, familyIndex) {
  const byId = familyIndex && familyIndex.byId ? familyIndex.byId : {};
  if (!personId || !byId[personId]) {
    return;
  }

  included[personId] = true;

  const rels = byId[personId].rels || {};
  const spouses = Array.isArray(rels.spouses) ? rels.spouses : [];
  spouses.forEach((spouseId) => {
    if (byId[spouseId]) {
      included[spouseId] = true;
    }
  });
}

function addPerson(included, personId, familyIndex) {
  const byId = familyIndex && familyIndex.byId ? familyIndex.byId : {};
  if (personId && byId[personId]) {
    included[personId] = true;
  }
}

function includeSiblingBranches(included, mainId, familyIndex) {
  const byId = familyIndex && familyIndex.byId ? familyIndex.byId : {};
  const parentsById = familyIndex && familyIndex.parentsById ? familyIndex.parentsById : {};
  const childrenById = familyIndex && familyIndex.childrenById ? familyIndex.childrenById : {};
  if (!mainId || !byId[mainId]) {
    return;
  }

  const siblingIds = {};
  const parents = Array.isArray(parentsById[mainId]) ? parentsById[mainId] : [];
  parents.forEach((parentId) => {
    const children = Array.isArray(childrenById[parentId]) ? childrenById[parentId] : [];
    children.forEach((childId) => {
      if (childId !== mainId && byId[childId]) {
        siblingIds[childId] = true;
      }
    });
  });

  Object.keys(siblingIds).forEach((siblingId) => {
    addPersonAndSpouses(included, siblingId, familyIndex);

    const siblingChildren = Array.isArray(childrenById[siblingId]) ? childrenById[siblingId] : [];
    siblingChildren.forEach((childId) => {
      addPerson(included, childId, familyIndex);
    });
  });
}

function buildScopedFamilyData(familyData, familyIndex, mainId) {
  const bloodIds = collectBloodFamilyIds(mainId, familyIndex);
  if (!Object.keys(bloodIds).length) {
    return Array.isArray(familyData) ? cloneData(familyData) : [];
  }

  const included = {};
  Object.keys(bloodIds).forEach((id) => {
    included[id] = true;
  });

  Object.keys(bloodIds).forEach((id) => {
    addPersonAndSpouses(included, id, familyIndex);
  });
  includeSiblingBranches(included, mainId, familyIndex);

  const filterIds = (ids) => (Array.isArray(ids) ? ids : []).filter((id) => !!included[id]);

  const scopedData = (Array.isArray(familyData) ? familyData : [])
    .filter((person) => person && person.id && included[person.id])
    .map((person) => {
      const rels = person && person.rels ? person.rels : {};
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

  return cloneData(scopedData);
}

function pickDefaultMainId(target, graph, familyData) {
  if (target.id && graph.nodes[target.id]) {
    return target.id;
  }

  if (target.dataPath) {
    const byPathId = Object.keys(graph.nodes).find(
      (nodeId) => normalizeDataPath(graph.nodes[nodeId].personPath) === target.dataPath
    );
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

  return Object.keys(graph.nodes).some(
    (nodeId) => normalizeDataPath(graph.nodes[nodeId].personPath) === target.dataPath
  );
}

function init() {
  const f3Api = familyChartApi();
  if (!f3Api) {
    console.error("arbol.js: family-chart no disponible en window.f3");
    const libError = document.getElementById("tree-error");
    if (libError) {
      libError.textContent = t("tree.messages.error", "No se pudo cargar el arbol genealogico.");
      libError.hidden = false;
    }
    return;
  }

  const loading = document.getElementById("tree-loading");
  const error = document.getElementById("tree-error");
  const target = getLaunchTarget();
  let selectedId = "";

  loadTreePayload()
    .then((payload) => {
      const graph = buildGraph(payload.unions, payload.records, payload.byId);
      const treeConfig = APP_CONFIG && APP_CONFIG.tree ? APP_CONFIG.tree : {};
      const container = document.getElementById("tree-canvas");
      if (!container) {
        throw new Error("No existe #tree-canvas");
      }
      const baseFamilyData = Array.isArray(payload.familyData) ? cloneData(payload.familyData) : [];
      const familyIndex = buildFamilyIndex(baseFamilyData);
      const defaultMainId = pickDefaultMainId(target, graph, baseFamilyData);
      const opensFromTarget = hasValidLaunchTarget(target, graph);

      const chart = f3Api
        .createChart(container, cloneData(baseFamilyData))
        .setTransitionTime(treeConfig.transitionMs || 420)
        .setCardXSpacing(treeConfig.cardSpacing && treeConfig.cardSpacing.x ? treeConfig.cardSpacing.x : 200)
        .setCardYSpacing(treeConfig.cardSpacing && treeConfig.cardSpacing.y ? treeConfig.cardSpacing.y : 140)
        .setShowSiblingsOfMain(true)
        .setSingleParentEmptyCard(false);

      const card = chart
        .setCardHtml()
        .setStyle("imageRect")
        .setCardImageField("avatar")
        .setCardDisplay([(datum) => datum.name || "", (datum) => datum.years || ""])
        .setCardDim(treeConfig.cardDim || {});

      card.setCardInnerHtmlCreator((treeDatum) => cardHtml(treeDatum.data.data, treeDatum.data.main));

      function applySelectedState() {
        document.querySelectorAll(".tree-node-card--selected").forEach((el) => {
          el.classList.remove("tree-node-card--selected");
        });
        if (!selectedId) {
          return;
        }
        document.querySelectorAll(`.card_cont[data-pid='${selectedId}'] .tree-node-card`).forEach((el) => {
          el.classList.add("tree-node-card--selected");
        });
      }

      function focusPerson(personId, options) {
        if (!personId || !graph.nodes[personId]) {
          return;
        }
        const opts = options || {};
        selectedId = personId;
        const scopedData = buildScopedFamilyData(baseFamilyData, familyIndex, personId);
        chart.setShowSiblingsOfMain(true);
        chart.updateData(scopedData);
        chart.updateMainId(personId);
        chart.updateTree({
          initial: !!opts.initial,
          tree_position: opts.treePosition || "fit"
        });
        applySelectedState();
        if (!opts.skipPanel) {
          openPanel(personId, graph, payload.detailTemplate, (nodeId) => {
            focusPerson(nodeId, {
              treePosition: "fit"
            });
          });
        }
      }

      card.setOnCardClick((event, treeDatum) => {
        event.stopPropagation();
        focusPerson(treeDatum.data.id);
      });

      card.setOnCardUpdate(function (treeDatum) {
        // `this` is bound by family-chart to the card DOM element — keep as a regular function.
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

      const closeBtn = document.getElementById("tree-panel-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          selectedId = "";
          applySelectedState();
          closePanel();
        });
      }

      const wrapper = document.getElementById("tree-wrapper");
      if (wrapper) {
        wrapper.addEventListener("click", (event) => {
          if (!event.target.closest(".tree-node-card") && !event.target.closest(".tree-panel")) {
            selectedId = "";
            applySelectedState();
            closePanel();
          }
        });
      }
    })
    .catch((err) => {
      console.error("arbol.js:", err);
      if (loading) {
        loading.remove();
      }
      if (error) {
        error.hidden = false;
      }
    });
}

bootstrapPage(init);
