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

function openInitialTarget(target, graph, focusPerson) {
  if (target.id && graph.nodes[target.id]) {
    focusPerson(target.id, { center: true });
    return;
  }

  if (!target.dataPath) {
    return;
  }

  var id = Object.keys(graph.nodes).find(function (nodeId) {
    return normalizeDataPath(graph.nodes[nodeId].personPath) === target.dataPath;
  });

  if (id) {
    focusPerson(id, { center: true });
  }
}

function pickGlobalMainId(f3Api, familyData) {
  if (!Array.isArray(familyData) || !familyData.length) {
    return "";
  }
  if (typeof f3Api.calculateTree !== "function") {
    return familyData[0].id;
  }

  var bestId = familyData[0].id;
  var bestCount = -1;

  familyData.forEach(function (person) {
    if (!person || !person.id) {
      return;
    }
    try {
      var scratchData = JSON.parse(JSON.stringify(familyData));
      var tree = f3Api.calculateTree(scratchData, {
        main_id: person.id,
        show_siblings_of_main: true,
        single_parent_empty_card: false
      });
      var count = tree && Array.isArray(tree.data) ? tree.data.length : 0;
      if (count > bestCount) {
        bestCount = count;
        bestId = person.id;
      }
    } catch (error) {
      // Ignore invalid candidate and continue.
    }
  });

  return bestId;
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
  var centerOnSelection = false;

  loadTreePayload()
    .then(function (payload) {
      var graph = buildGraph(payload.unions, payload.records, payload.byId);
      var treeConfig = APP_CONFIG && APP_CONFIG.tree ? APP_CONFIG.tree : {};
      var container = document.getElementById("tree-canvas");
      if (!container) {
        throw new Error("No existe #tree-canvas");
      }

      var chart = f3Api.createChart(container, payload.familyData)
        .setTransitionTime(treeConfig.transitionMs || 420)
        .setCardXSpacing(treeConfig.cardSpacing && treeConfig.cardSpacing.x ? treeConfig.cardSpacing.x : 200)
        .setCardYSpacing(treeConfig.cardSpacing && treeConfig.cardSpacing.y ? treeConfig.cardSpacing.y : 140)
        .setShowSiblingsOfMain(true)
        .setSingleParentEmptyCard(false);
      var globalMainId = pickGlobalMainId(f3Api, payload.familyData);

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
        var shouldCenter = Object.prototype.hasOwnProperty.call(opts, "center")
          ? !!opts.center
          : centerOnSelection;
        if (shouldCenter) {
          chart.updateMainId(personId);
          chart.updateTree({
            initial: false,
            tree_position: opts.treePosition || "main_to_middle"
          });
        }
        applySelectedState();
        if (!opts.skipPanel) {
          openPanel(personId, graph, payload.detailTemplate, function (nodeId) {
            focusPerson(nodeId, { treePosition: "main_to_middle", center: true });
          });
        }
      }

      function showGlobalView() {
        if (globalMainId) {
          chart.updateMainId(globalMainId);
        }
        chart.updateTree({
          initial: false,
          tree_position: "fit"
        });
        selectedId = "";
        applySelectedState();
        closePanel();
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

      if (globalMainId) {
        chart.updateMainId(globalMainId);
      }
      chart.updateTree({
        initial: true,
        tree_position: "fit"
      });

      bindToolbar(chart, f3Api);
      var showAllBtn = document.getElementById("btn-show-all");
      if (showAllBtn) {
        function syncModeButton() {
          showAllBtn.textContent = centerOnSelection
            ? t("tree.toolbar.modeCenter", "Modo: Centrar seleccion")
            : t("tree.toolbar.modeGlobal", "Modo: Vista global");
          showAllBtn.setAttribute("aria-pressed", centerOnSelection ? "true" : "false");
        }
        syncModeButton();
        showAllBtn.addEventListener("click", function () {
          centerOnSelection = !centerOnSelection;
          syncModeButton();
          if (!centerOnSelection) {
            showGlobalView();
          } else if (selectedId) {
            focusPerson(selectedId, {
              center: true,
              treePosition: "main_to_middle",
              skipPanel: true
            });
          }
        });
      }
      openInitialTarget(target, graph, focusPerson);
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
