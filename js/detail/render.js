import { escapeHtml, setText } from "../core/html.js";
import { t } from "../core/i18n.js";
import { inferTreeKeyFromPath, buildQueryUrl } from "../core/url.js";
import { getTemplates } from "../config/app-config.js";

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

/** Solo se admiten rutas relativas del propio sitio: nada de origenes externos. */
function isLocalImageSrc(src) {
  const value = String(src || "").trim();
  return !!value && !/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith("//");
}

function renderHeroImage(image) {
  const figure = document.getElementById("person-figure");
  const imageElement = document.getElementById("person-image");
  const captionElement = document.getElementById("person-image-caption");
  if (!imageElement || !captionElement) {
    return;
  }

  if (!image || !isLocalImageSrc(image.src)) {
    imageElement.removeAttribute("src");
    imageElement.alt = "";
    if (figure) {
      figure.hidden = true;
    }
    captionElement.textContent = t("detail.messages.noMainImage", "Sin imagen principal.");
    return;
  }

  if (figure) {
    figure.hidden = false;
  }
  const source = document.getElementById("person-image-webp");
  if (source) {
    if (image.srcWebp) {
      source.srcset = image.srcWebp;
    } else {
      source.removeAttribute("srcset");
    }
  }
  imageElement.src = image.src;
  imageElement.alt = image.alt || "";
  if (image.width && image.height) {
    imageElement.width = image.width;
    imageElement.height = image.height;
  }
  captionElement.textContent = image.caption || "";
}

/** WebP con respaldo JPEG, y las dimensiones explicitas para que no salte el layout. */
function pictureHtml(image, extraAttrs) {
  const dimensions = image.width && image.height ? ` width="${image.width}" height="${image.height}"` : "";
  const img =
    `<img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || "")}"` +
    `${dimensions} loading="lazy" decoding="async"${extraAttrs || ""}>`;

  if (!image.srcWebp) {
    return img;
  }
  return `<picture><source srcset="${escapeHtml(image.srcWebp)}" type="image/webp">${img}</picture>`;
}

function renderGallery(images) {
  renderItemsOrFallback(
    "person-gallery",
    images,
    `<p>${escapeHtml(t("detail.messages.noGalleryImages", "No hay imagenes adicionales."))}</p>`,
    (image) => {
      const media = image.full
        ? `<a class="gallery-card__link" href="${escapeHtml(image.full)}">${pictureHtml(image)}</a>`
        : pictureHtml(image);
      return (
        `<figure class="gallery-card">${media}` +
        `<figcaption>${escapeHtml(image.caption || "")}</figcaption></figure>`
      );
    }
  );
}

export function setTreeLink(dataPath, personId, treeKey) {
  const element = document.getElementById("person-tree-link");
  if (!element) {
    return;
  }
  element.href = buildQueryUrl(getTemplates().tree, {
    tree: treeKey || inferTreeKeyFromPath(dataPath),
    id: personId,
    data: personId ? "" : dataPath
  });
}

export function renderDetailPage(data) {
  const pageDefault = t("detail.title.pageDefault", "Ficha personal");
  const pageSuffix = t("detail.title.suffix", "Familia Martin - Tapias");
  document.title = `${data.name || pageDefault} | ${pageSuffix}`;
  setText("person-name", data.name || pageDefault);
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
