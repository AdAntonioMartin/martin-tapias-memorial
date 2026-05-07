import { getLaunchTarget, loadTreePayload } from "./tree/data.js";
import { buildGraph } from "./tree/graph.js";
import { computeLayout } from "./tree/layout.js";
import { renderConnectors, renderNodes } from "./tree/render.js";
import { closePanel, openPanel } from "./tree/panel.js";
import { createViewportController } from "./tree/viewport.js";
import { normalizeDataPath } from "./tree/utils.js";
import { applyAppTheme } from "./core/theme.js";

function openInitialTarget(target, graph, detailTemplate, viewport) {
  if (target.id && graph.nodes[target.id]) {
    openPanel(target.id, graph, detailTemplate, function (id) {
      viewport.centerOn(id);
    });
    viewport.centerOn(target.id);
    return;
  }

  if (!target.dataPath) {
    return;
  }

  var id = Object.keys(graph.nodes).find(function (nodeId) {
    return normalizeDataPath(graph.nodes[nodeId].personPath) === target.dataPath;
  });

  if (id) {
    openPanel(id, graph, detailTemplate, function (nodeId) {
      viewport.centerOn(nodeId);
    });
    viewport.centerOn(id);
  }
}

function init() {
  var loading = document.getElementById("tree-loading");
  var error = document.getElementById("tree-error");
  var target = getLaunchTarget();

  loadTreePayload()
    .then(function (payload) {
      var graph = buildGraph(payload.unions, payload.records, payload.byId);
      var layout = computeLayout(graph);
      var viewport = createViewportController(layout);

      if (loading) {
        loading.remove();
      }

      renderConnectors(graph, layout);
      renderNodes(graph, layout, function (personId) {
        openPanel(personId, graph, payload.detailTemplate, function (nodeId) {
          viewport.centerOn(nodeId);
        });
        viewport.centerOn(personId);
      });

      viewport.bind();
      viewport.fitAll();
      openInitialTarget(target, graph, payload.detailTemplate, viewport);

      var closeBtn = document.getElementById("tree-panel-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", closePanel);
      }

      var wrapper = document.getElementById("tree-wrapper");
      if (wrapper) {
        wrapper.addEventListener("click", function (event) {
          if (!event.target.closest(".tree-node-card")) {
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

document.addEventListener("DOMContentLoaded", init);
applyAppTheme();
