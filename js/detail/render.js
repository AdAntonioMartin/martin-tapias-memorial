import { escapeHtml, setText } from "../core/html.js";
import { t } from "../core/i18n.js";
import { inferTreeKeyFromPath, buildQueryUrl } from "../core/url.js";

function renderItemsOrFallback(elementId, items, fallbackHtml, itemTemplateFn) {
  const target = document.getElementById(elementId);
  if (!target) {
    return;
  }

  if (!items || !items.length) {
    target.innerHTML = fallbackHtml;
    return;
  }

  target.innerHTML = items.map(itemTemplateFn).join("");
}

function renderFacts(facts) {
  renderItemsOrFallback(
    "person-facts",
    facts,
    `<div><dt>${escapeHtml(t("detail.messages.info", "Informacion"))}</dt><dd>${escapeHtml(t("detail.messages.notAvailable", "No disponible."))}</dd></div>`,
    (fact) => `<div><dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.value)}</dd></div>`
  );
}

function renderBiography(paragraphs) {
  renderItemsOrFallback(
    "person-biography",
    paragraphs,
    `<p>${escapeHtml(t("detail.messages.bioNotAvailable", "No hay biografia disponible."))}</p>`,
    (paragraph) => `<p>${escapeHtml(paragraph)}</p>`
  );
}

function renderHeroImage(image) {
  const imageElement = document.getElementById("person-image");
  const captionElement = document.getElementById("person-image-caption");
  if (!imageElement || !captionElement) {
    return;
  }

  if (!image) {
    imageElement.removeAttribute("src");
    imageElement.alt = "";
    captionElement.textContent = t("detail.messages.noMainImage", "Sin imagen principal.");
    return;
  }

  imageElement.src = image.src;
  imageElement.alt = image.alt || "";
  captionElement.textContent = image.caption || "";
}

function renderGallery(images) {
  renderItemsOrFallback(
    "person-gallery",
    images,
    `<p>${escapeHtml(t("detail.messages.noGalleryImages", "No hay imagenes adicionales."))}</p>`,
    (image) =>
      `<figure class="gallery-card">` +
      `<img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || "")}">` +
      `<figcaption>${escapeHtml(image.caption || "")}</figcaption>` +
      `</figure>`
  );
}

export function setTreeLink(dataPath, personId, treeKey) {
  const element = document.getElementById("person-tree-link");
  if (!element) {
    return;
  }
  const resolvedTreeKey = treeKey || inferTreeKeyFromPath(dataPath);

  if (personId) {
    element.href = buildQueryUrl("arbol.html", { tree: resolvedTreeKey, id: personId });
    return;
  }

  if (!dataPath) {
    element.href = "arbol.html";
    return;
  }

  element.href = buildQueryUrl("arbol.html", { tree: resolvedTreeKey, data: dataPath });
}

export function renderDetailPage(data) {
  const pageDefault = t("detail.title.pageDefault", "Ficha personal");
  const pageSuffix = t("detail.title.suffix", "Familia Minguez - De Antonio");
  document.title = `${data.name || pageDefault} | ${pageSuffix}`;
  setText("person-name", data.name || pageDefault);
  setText("person-subtitle", data.subtitle || "");
  setText("person-summary", data.summary || "");
  renderFacts(data.facts);
  renderHeroImage(data.heroImage);
  renderBiography(data.biography);
  renderGallery(data.gallery);
}

export function renderDetailError(message) {
  setText("person-name", t("detail.messages.errorTitle", "No se pudo mostrar esta ficha"));
  setText("person-subtitle", "");
  setText("person-summary", message);
  renderFacts([]);
  renderHeroImage(null);
  renderBiography([]);
  renderGallery([]);
}
