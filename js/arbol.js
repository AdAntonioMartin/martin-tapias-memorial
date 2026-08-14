import { getLaunchTarget, loadTreePayload } from "./tree/data.js";
import { collectScopeIds, scopeFamilyChartData } from "./tree/scope.js";
import { bindPanelNavigation, closePanel, isPanelOpen, openPanel } from "./tree/panel.js";
import { GENDER_FALLBACK } from "./tree/config.js";
import { getTreeConfig } from "./config/index.js";
import { escapeHtml } from "./core/html.js";
import { t } from "./core/i18n.js";
import { normalizeDataPath } from "./core/url.js";
import { bootstrapPage } from "./core/bootstrap.js";

function showError(message) {
  const error = document.getElementById("tree-error");
  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
  const loading = document.getElementById("tree-loading");
  if (loading) {
    loading.hidden = true;
  }
}

/**
 * Tarjeta del arbol. Deliberadamente no usa las clases `card` ni `card-inner`
 * de family-chart: sus reglas pintan el fondo con un color de genero fijo, y
 * aqui el aspecto lo llevan los tokens del sitio.
 */
function cardHtml(person, isMain) {
  const classes = ["tree-node-card", `tree-node-card--${person.genderLabel}`];
  if (isMain) {
    classes.push("tree-node-card--main");
  }
  const avatar = person.avatar
    ? `<img src="${escapeHtml(person.avatar)}" alt="" width="44" height="44" loading="lazy" decoding="async">`
    : `<span class="tree-node-avatar-fallback">${escapeHtml(GENDER_FALLBACK[person.genderLabel])}</span>`;

  return (
    `<div class="${classes.join(" ")}">` +
    '<div class="tree-node-card__inner">' +
    `<div class="tree-node-avatar">${avatar}</div>` +
    `<div class="tree-node-name">${escapeHtml(person.name || "")}</div>` +
    `<div class="tree-node-years">${escapeHtml(person.years || "")}</div>` +
    "</div>" +
    "</div>"
  );
}

function bindToolbar(chart, f3Api) {
  const treeConfig = getTreeConfig();
  const zoom = (amount) =>
    f3Api.handlers.manualZoom({ amount, svg: chart.svg, transition_time: treeConfig.zoomTransitionMs });

  const actions = {
    "btn-zoom-in": () => zoom(treeConfig.zoomStep),
    "btn-zoom-out": () => zoom(1 / treeConfig.zoomStep),
    "btn-fit": () => chart.updateTree({ initial: false, tree_position: "fit" })
  };

  Object.entries(actions).forEach(([id, handler]) => {
    const button = document.getElementById(id);
    if (button) {
      button.addEventListener("click", handler);
    }
  });
}

/** Persona pedida por `?id=` o `?data=`, o "" si la URL no apunta a nadie del arbol. */
function resolveTargetId(target, model) {
  if (target.id && model.people.has(target.id)) {
    return target.id;
  }
  if (target.dataPath) {
    for (const [id, person] of model.people) {
      if (normalizeDataPath(person.personPath) === target.dataPath) {
        return id;
      }
    }
  }
  return "";
}

function init() {
  const f3Api = window.f3 || null;
  if (!f3Api) {
    console.error("arbol.js: family-chart no disponible en window.f3");
    showError(t("tree.messages.errorLibrary", "No se pudo cargar la libreria del arbol genealogico."));
    return;
  }

  const target = getLaunchTarget();

  loadTreePayload()
    .then((payload) => {
      const container = document.getElementById("tree-canvas");
      if (!container) {
        throw new Error("No existe #tree-canvas");
      }

      const { model, familyData, detailTemplate } = payload;
      const treeConfig = getTreeConfig();
      let selectedId = "";

      const chart = f3Api
        .createChart(container, scopeFamilyChartData(familyData, null))
        .setTransitionTime(treeConfig.transitionMs)
        .setCardXSpacing(treeConfig.cardSpacing.x)
        .setCardYSpacing(treeConfig.cardSpacing.y)
        .setShowSiblingsOfMain(true)
        .setSingleParentEmptyCard(false);

      const card = chart
        .setCardHtml()
        .setStyle("imageRect")
        .setCardImageField("avatar")
        .setCardDisplay([(datum) => datum.name || "", (datum) => datum.years || ""])
        .setCardDim(treeConfig.cardDim);

      card.setCardInnerHtmlCreator((treeDatum) => cardHtml(treeDatum.data.data, treeDatum.data.main));

      /**
       * Marca la tarjeta seleccionada. Se llama una vez por redibujado, no una
       * vez por tarjeta: antes vivia dentro de setCardUpdate y disparaba dos
       * querySelectorAll globales por cada una de las ~150 tarjetas.
       */
      function applySelectedState() {
        container.querySelectorAll(".tree-node-card--selected").forEach((el) => {
          el.classList.remove("tree-node-card--selected");
        });
        if (!selectedId) {
          return;
        }
        container
          .querySelectorAll(`.card_cont[data-pid="${CSS.escape(selectedId)}"] .tree-node-card`)
          .forEach((el) => el.classList.add("tree-node-card--selected"));
      }

      function focusPerson(personId, options) {
        if (!model.people.has(personId)) {
          return;
        }
        const opts = options || {};
        selectedId = personId;

        chart.updateData(scopeFamilyChartData(familyData, collectScopeIds(model, personId)));
        chart.updateMainId(personId);
        chart.updateTree({ initial: !!opts.initial, tree_position: "fit" });
        applySelectedState();

        if (!opts.skipPanel) {
          openPanel(personId, model, detailTemplate);
        }
      }

      card.setOnCardClick((event, treeDatum) => {
        event.stopPropagation();
        focusPerson(treeDatum.data.id);
      });

      card.setOnCardUpdate(function (treeDatum) {
        // `this` lo enlaza family-chart al elemento de la tarjeta: debe seguir siendo function.
        this.dataset.pid = treeDatum.data.id;
      });

      const loading = document.getElementById("tree-loading");
      if (loading) {
        loading.hidden = true;
      }

      const targetId = resolveTargetId(target, model);
      const rootId =
        payload.rootPersonId && model.people.has(payload.rootPersonId) ? payload.rootPersonId : "";
      const mainId = targetId || rootId || (familyData.length ? familyData[0].id : "");
      if (mainId) {
        // El panel solo se abre solo si la URL pedia una persona concreta.
        focusPerson(mainId, { initial: true, skipPanel: !targetId });
      } else {
        chart.updateTree({ initial: true, tree_position: "fit" });
      }

      bindToolbar(chart, f3Api);
      bindPanelNavigation((personId) => focusPerson(personId));

      function deselect() {
        selectedId = "";
        applySelectedState();
        closePanel();
      }

      const closeBtn = document.getElementById("tree-panel-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", deselect);
      }

      const wrapper = document.getElementById("tree-wrapper");
      if (wrapper) {
        wrapper.addEventListener("click", (event) => {
          if (!event.target.closest(".tree-node-card") && !event.target.closest(".tree-panel")) {
            deselect();
          }
        });
      }

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && isPanelOpen()) {
          deselect();
        }
      });
    })
    .catch((err) => {
      console.error("arbol.js:", err);
      showError(t("tree.messages.error", "No se pudo cargar el arbol genealogico."));
    });
}

bootstrapPage(init);
