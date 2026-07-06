import { GENDER_COLOR, GENDER_EMOJI } from "./config.js";
import { escapeHtml } from "../core/html.js";
import { t } from "../core/i18n.js";

function detailUrl(node, detailTemplate) {
  var template = detailTemplate || "persona.html";
  var params = new URLSearchParams();
  var current = new URLSearchParams(window.location.search);
  var treeKey = current.get("tree") || "";
  if (treeKey) {
    params.set("tree", treeKey);
  }
  params.set("id", node.id);
  if (node.personPath) {
    params.set("data", node.personPath);
  }
  return template + "?" + params.toString();
}

function roleByGender(gender, asParent) {
  if (asParent) {
    if (gender === "male") {
      return t("tree.panel.roles.father", "Padre");
    }
    if (gender === "female") {
      return t("tree.panel.roles.mother", "Madre");
    }
    return t("tree.panel.roles.parent", "Progenitor");
  }
  if (gender === "male") {
    return t("tree.panel.roles.son", "Hijo");
  }
  if (gender === "female") {
    return t("tree.panel.roles.daughter", "Hija");
  }
  return t("tree.panel.roles.child", "Hijo/a");
}

export function closePanel() {
  var panel = document.getElementById("tree-panel");
  if (panel) {
    panel.hidden = true;
  }
  document.querySelectorAll(".tree-node-card--selected").forEach(function (el) {
    el.classList.remove("tree-node-card--selected");
  });
}

export function openPanel(personId, graph, detailTemplate, onNavigate) {
  var node = graph.nodes[personId];
  if (!node) {
    return;
  }

  document.querySelectorAll(".tree-node-card--selected").forEach(function (el) {
    el.classList.remove("tree-node-card--selected");
  });
  document.querySelectorAll(".card_cont[data-pid='" + personId + "'] .tree-node-card").forEach(function (card) {
    card.classList.add("tree-node-card--selected");
  });

  var panel = document.getElementById("tree-panel");
  var header = document.getElementById("tree-panel-header");
  var body = document.getElementById("tree-panel-body");
  if (!panel || !header || !body) {
    return;
  }

  var accent = GENDER_COLOR[node.gender] || GENDER_COLOR.unknown;
  var avatarHtml = node.photo
    ? '<img src="' + escapeHtml(node.photo) + '" alt="' + escapeHtml(node.name) + '">'
    : escapeHtml(GENDER_EMOJI[node.gender] || GENDER_EMOJI.unknown);

  header.innerHTML =
    '<div class="tree-panel__avatar" style="border-color:' + accent + '55">' + avatarHtml + "</div>" +
    '<p class="tree-panel__name">' + escapeHtml(node.name) + "</p>" +
    '<p class="tree-panel__years">' + escapeHtml(node.years) + "</p>";

  var html = "";
  if (node.record && node.record.summary) {
    html +=
      '<div class="tree-panel__section">' +
      '<p class="tree-panel__section-label">' + escapeHtml(t("tree.panel.summary", "Resumen")) + "</p>" +
      '<p class="tree-panel__section-text">' + escapeHtml(node.record.summary) + "</p>" +
      "</div>";
  }

  if (node.parentUnion && graph.unionMap[node.parentUnion]) {
    var parentUnion = graph.unionMap[node.parentUnion];
    html += '<div class="tree-panel__section"><p class="tree-panel__section-label">' + escapeHtml(t("tree.panel.parents", "Padres")) + "</p>";
    (parentUnion.partners || []).forEach(function (parentId) {
      var parent = graph.nodes[parentId];
      if (!parent) {
        return;
      }
      var color = GENDER_COLOR[parent.gender] || GENDER_COLOR.unknown;
      html +=
        '<div class="tree-panel__ref" data-pid="' + escapeHtml(parentId) + '">' +
        '<div class="tree-panel__ref-dot" style="background:' + color + '"></div>' +
        '<span class="tree-panel__ref-name">' + escapeHtml(parent.name) + "</span>" +
        '<span class="tree-panel__ref-role">' + roleByGender(parent.gender, true) + "</span>" +
        "</div>";
    });
    html += "</div>";
  }

  (node.unionIds || []).forEach(function (unionId) {
    var union = graph.unionMap[unionId];
    if (!union) {
      return;
    }

    var unionLabel = {
      married: t("tree.panel.union.married", "Matrimonio"),
      divorced: t("tree.panel.union.divorced", "Divorciados"),
      unmarried: t("tree.panel.union.unmarried", "Sin matrimonio")
    }[union.type] || t("tree.panel.union.default", "Union");

    html +=
      '<div class="tree-panel__section">' +
      '<p class="tree-panel__section-label">' + escapeHtml(unionLabel + (union.married ? " - " + union.married : "")) + "</p>";

    (union.partners || []).forEach(function (partnerId) {
      if (partnerId === personId) {
        return;
      }
      var partner = graph.nodes[partnerId];
      if (!partner) {
        return;
      }
      var color = GENDER_COLOR[partner.gender] || GENDER_COLOR.unknown;
      html +=
        '<div class="tree-panel__ref" data-pid="' + escapeHtml(partnerId) + '">' +
        '<div class="tree-panel__ref-dot" style="background:' + color + '"></div>' +
        '<span class="tree-panel__ref-name">' + escapeHtml(partner.name) + "</span>" +
        '<span class="tree-panel__ref-role">' + escapeHtml(t("tree.panel.partnerRole", "Pareja")) + "</span>" +
        "</div>";
    });

    if (union.children && union.children.length) {
      html += '<p class="tree-panel__section-label" style="margin-top:.5rem">' + escapeHtml(t("tree.panel.children", "Hijos")) + "</p>";
      union.children.forEach(function (childId) {
        var child = graph.nodes[childId];
        if (!child) {
          return;
        }
        var color = GENDER_COLOR[child.gender] || GENDER_COLOR.unknown;
        html +=
          '<div class="tree-panel__ref" data-pid="' + escapeHtml(childId) + '">' +
          '<div class="tree-panel__ref-dot" style="background:' + color + '"></div>' +
          '<span class="tree-panel__ref-name">' + escapeHtml(child.name) + "</span>" +
          '<span class="tree-panel__ref-role">' + roleByGender(child.gender, false) + "</span>" +
          "</div>";
      });
    }

    html += "</div>";
  });

  html +=
    '<a class="tree-panel__profile-link" href="' + escapeHtml(detailUrl(node, detailTemplate)) + '">' + escapeHtml(t("tree.panel.profileLink", "Ver ficha completa ->")) + "</a>";
  body.innerHTML = html;

  body.querySelectorAll(".tree-panel__ref[data-pid]").forEach(function (el) {
    el.addEventListener("click", function () {
      var targetId = el.dataset.pid;
      openPanel(targetId, graph, detailTemplate, onNavigate);
      if (typeof onNavigate === "function") {
        onNavigate(targetId);
      }
    });
  });

  panel.hidden = false;
}
