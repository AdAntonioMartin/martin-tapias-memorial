import { GENDER_FALLBACK } from "./config.js";
import { escapeHtml } from "../core/html.js";
import { t } from "../core/i18n.js";
import { buildPersonUrl, getTreeKeyFromUrl } from "../core/url.js";

let lastFocusedElement = null;
let navigateHandler = null;

function roleByGender(gender, asParent) {
  if (asParent) {
    if (gender === "male") return t("tree.panel.roles.father", "Padre");
    if (gender === "female") return t("tree.panel.roles.mother", "Madre");
    return t("tree.panel.roles.parent", "Progenitor");
  }
  if (gender === "male") return t("tree.panel.roles.son", "Hijo");
  if (gender === "female") return t("tree.panel.roles.daughter", "Hija");
  return t("tree.panel.roles.child", "Hijo/a");
}

function unionLabel(union) {
  const labels = {
    married: t("tree.panel.union.married", "Matrimonio"),
    divorced: t("tree.panel.union.divorced", "Divorciados"),
    unmarried: t("tree.panel.union.unmarried", "Sin matrimonio")
  };
  const base = labels[union.type] || t("tree.panel.union.default", "Union");
  return union.married ? `${base} - ${union.married}` : base;
}

/**
 * Referencia navegable a otra persona. Es un <button> y no un <div> con click:
 * el panel es la unica forma de recorrer la genealogia sin raton.
 */
function renderRefItem(person, roleLabel) {
  return (
    `<button type="button" class="tree-panel__ref" data-pid="${escapeHtml(person.id)}">` +
    `<span class="tree-panel__ref-dot tree-panel__ref-dot--${escapeHtml(person.gender)}" aria-hidden="true"></span>` +
    `<span class="tree-panel__ref-name">${escapeHtml(person.name)}</span>` +
    `<span class="tree-panel__ref-role">${escapeHtml(roleLabel)}</span>` +
    "</button>"
  );
}

function renderSection(label, itemsHtml) {
  if (!itemsHtml) {
    return "";
  }
  return (
    '<div class="tree-panel__section">' +
    `<p class="tree-panel__section-label">${escapeHtml(label)}</p>` +
    itemsHtml +
    "</div>"
  );
}

function renderParents(model, person) {
  const union = person.parentUnionId ? model.unions.get(person.parentUnionId) : null;
  if (!union) {
    return "";
  }
  const items = union.partners
    .map((parentId) => model.people.get(parentId))
    .filter(Boolean)
    .map((parent) => renderRefItem(parent, roleByGender(parent.gender, true)))
    .join("");
  return renderSection(t("tree.panel.parents", "Padres"), items);
}

function renderUnions(model, person) {
  return person.unionIds
    .map((unionId) => model.unions.get(unionId))
    .filter(Boolean)
    .map((union) => {
      const partners = union.partners
        .filter((partnerId) => partnerId !== person.id)
        .map((partnerId) => model.people.get(partnerId))
        .filter(Boolean)
        .map((partner) => renderRefItem(partner, t("tree.panel.partnerRole", "Pareja")))
        .join("");

      const children = union.children
        .map((childId) => model.people.get(childId))
        .filter(Boolean)
        .map((child) => renderRefItem(child, roleByGender(child.gender, false)))
        .join("");

      const childrenBlock = children
        ? `<p class="tree-panel__section-label tree-panel__section-label--sub">${escapeHtml(
            t("tree.panel.children", "Hijos")
          )}</p>${children}`
        : "";

      return renderSection(unionLabel(union), partners + childrenBlock);
    })
    .join("");
}

function panelElements() {
  return {
    panel: document.getElementById("tree-panel"),
    header: document.getElementById("tree-panel-header"),
    body: document.getElementById("tree-panel-body")
  };
}

export function isPanelOpen() {
  const { panel } = panelElements();
  return !!panel && !panel.hidden;
}

export function closePanel() {
  const { panel } = panelElements();
  if (!panel || panel.hidden) {
    return;
  }
  panel.hidden = true;
  panel.setAttribute("inert", "");
  if (lastFocusedElement && document.contains(lastFocusedElement)) {
    lastFocusedElement.focus();
  }
  lastFocusedElement = null;
}

export function openPanel(personId, model, detailTemplate) {
  const person = model.people.get(personId);
  const { panel, header, body } = panelElements();
  if (!person || !panel || !header || !body) {
    return;
  }

  if (panel.hidden) {
    lastFocusedElement = document.activeElement;
  }

  const avatarHtml = person.photo
    ? `<img src="${escapeHtml(person.photo)}" alt="" width="72" height="72" loading="lazy" decoding="async">`
    : `<span class="tree-panel__avatar-fallback">${escapeHtml(GENDER_FALLBACK[person.gender])}</span>`;

  header.innerHTML =
    `<div class="tree-panel__avatar tree-panel__avatar--${escapeHtml(person.gender)}">${avatarHtml}</div>` +
    `<h2 class="tree-panel__name" id="tree-panel-name">${escapeHtml(person.name)}</h2>` +
    `<p class="tree-panel__years">${escapeHtml(person.years)}</p>`;

  const summary = person.summary
    ? renderSection(
        t("tree.panel.summary", "Resumen"),
        `<p class="tree-panel__section-text">${escapeHtml(person.summary)}</p>`
      )
    : "";

  const profileHref = buildPersonUrl(detailTemplate, {
    id: person.id,
    personPath: person.personPath,
    treeKey: getTreeKeyFromUrl()
  });

  body.innerHTML =
    summary +
    renderParents(model, person) +
    renderUnions(model, person) +
    `<a class="tree-panel__profile-link" href="${escapeHtml(profileHref)}">${escapeHtml(
      t("tree.panel.profileLink", "Ver ficha completa")
    )}</a>`;

  panel.removeAttribute("inert");
  panel.hidden = false;
}

/**
 * Un unico listener delegado, en lugar de re-enlazar uno por referencia cada
 * vez que se abre el panel.
 */
export function bindPanelNavigation(onNavigate) {
  navigateHandler = onNavigate;
  const body = document.getElementById("tree-panel-body");
  if (!body) {
    return;
  }
  body.addEventListener("click", (event) => {
    const ref = event.target.closest(".tree-panel__ref[data-pid]");
    if (ref && typeof navigateHandler === "function") {
      navigateHandler(ref.dataset.pid);
    }
  });
}
