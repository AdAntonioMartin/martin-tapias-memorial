import { GENDER_COLOR, GENDER_EMOJI } from "./config.js";
import { escapeHtml } from "../core/html.js";
import { t } from "../core/i18n.js";
import { buildQueryUrl } from "../core/url.js";

function detailUrl(node, detailTemplate) {
  const template = detailTemplate || "persona.html";
  const treeKey = new URLSearchParams(window.location.search).get("tree") || "";
  return buildQueryUrl(template, { tree: treeKey, id: node.id, data: node.personPath });
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

function renderRefItem(id, name, gender, roleLabel) {
  const color = GENDER_COLOR[gender] || GENDER_COLOR.unknown;
  return (
    `<div class="tree-panel__ref" data-pid="${escapeHtml(id)}">` +
    `<div class="tree-panel__ref-dot" style="background:${color}"></div>` +
    `<span class="tree-panel__ref-name">${escapeHtml(name)}</span>` +
    `<span class="tree-panel__ref-role">${roleLabel}</span>` +
    "</div>"
  );
}

export function closePanel() {
  const panel = document.getElementById("tree-panel");
  if (panel) {
    panel.hidden = true;
  }
  document.querySelectorAll(".tree-node-card--selected").forEach((el) => {
    el.classList.remove("tree-node-card--selected");
  });
}

export function openPanel(personId, graph, detailTemplate, onNavigate) {
  const node = graph.nodes[personId];
  if (!node) {
    return;
  }

  document.querySelectorAll(".tree-node-card--selected").forEach((el) => {
    el.classList.remove("tree-node-card--selected");
  });
  document.querySelectorAll(`.card_cont[data-pid='${personId}'] .tree-node-card`).forEach((card) => {
    card.classList.add("tree-node-card--selected");
  });

  const panel = document.getElementById("tree-panel");
  const header = document.getElementById("tree-panel-header");
  const body = document.getElementById("tree-panel-body");
  if (!panel || !header || !body) {
    return;
  }

  const accent = GENDER_COLOR[node.gender] || GENDER_COLOR.unknown;
  const avatarHtml = node.photo
    ? `<img src="${escapeHtml(node.photo)}" alt="${escapeHtml(node.name)}">`
    : escapeHtml(GENDER_EMOJI[node.gender] || GENDER_EMOJI.unknown);

  header.innerHTML =
    `<div class="tree-panel__avatar" style="border-color:${accent}55">${avatarHtml}</div>` +
    `<p class="tree-panel__name">${escapeHtml(node.name)}</p>` +
    `<p class="tree-panel__years">${escapeHtml(node.years)}</p>`;

  let html = "";
  if (node.record && node.record.summary) {
    html +=
      '<div class="tree-panel__section">' +
      `<p class="tree-panel__section-label">${escapeHtml(t("tree.panel.summary", "Resumen"))}</p>` +
      `<p class="tree-panel__section-text">${escapeHtml(node.record.summary)}</p>` +
      "</div>";
  }

  if (node.parentUnion && graph.unionMap[node.parentUnion]) {
    const parentUnion = graph.unionMap[node.parentUnion];
    html += `<div class="tree-panel__section"><p class="tree-panel__section-label">${escapeHtml(t("tree.panel.parents", "Padres"))}</p>`;
    (parentUnion.partners || []).forEach((parentId) => {
      const parent = graph.nodes[parentId];
      if (!parent) {
        return;
      }
      html += renderRefItem(parentId, parent.name, parent.gender, roleByGender(parent.gender, true));
    });
    html += "</div>";
  }

  (node.unionIds || []).forEach((unionId) => {
    const union = graph.unionMap[unionId];
    if (!union) {
      return;
    }

    const unionLabel =
      {
        married: t("tree.panel.union.married", "Matrimonio"),
        divorced: t("tree.panel.union.divorced", "Divorciados"),
        unmarried: t("tree.panel.union.unmarried", "Sin matrimonio")
      }[union.type] || t("tree.panel.union.default", "Union");

    html +=
      '<div class="tree-panel__section">' +
      `<p class="tree-panel__section-label">${escapeHtml(unionLabel + (union.married ? ` - ${union.married}` : ""))}</p>`;

    (union.partners || []).forEach((partnerId) => {
      if (partnerId === personId) {
        return;
      }
      const partner = graph.nodes[partnerId];
      if (!partner) {
        return;
      }
      html += renderRefItem(
        partnerId,
        partner.name,
        partner.gender,
        escapeHtml(t("tree.panel.partnerRole", "Pareja"))
      );
    });

    if (union.children && union.children.length) {
      html += `<p class="tree-panel__section-label" style="margin-top:.5rem">${escapeHtml(t("tree.panel.children", "Hijos"))}</p>`;
      union.children.forEach((childId) => {
        const child = graph.nodes[childId];
        if (!child) {
          return;
        }
        html += renderRefItem(childId, child.name, child.gender, roleByGender(child.gender, false));
      });
    }

    html += "</div>";
  });

  html += `<a class="tree-panel__profile-link" href="${escapeHtml(detailUrl(node, detailTemplate))}">${escapeHtml(t("tree.panel.profileLink", "Ver ficha completa ->"))}</a>`;
  body.innerHTML = html;

  body.querySelectorAll(".tree-panel__ref[data-pid]").forEach((el) => {
    el.addEventListener("click", () => {
      const targetId = el.dataset.pid;
      openPanel(targetId, graph, detailTemplate, onNavigate);
      if (typeof onNavigate === "function") {
        onNavigate(targetId);
      }
    });
  });

  panel.hidden = false;
}
