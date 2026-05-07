import { escapeHtml, setText } from "../core/html.js";
import { t } from "../core/i18n.js";

function renderFacts(facts) {
  var target = document.getElementById("person-facts");
  if (!target) {
    return;
  }

  if (!facts || !facts.length) {
    target.innerHTML = "<div><dt>" + escapeHtml(t("detail.messages.info", "Informacion")) + "</dt><dd>" + escapeHtml(t("detail.messages.notAvailable", "No disponible.")) + "</dd></div>";
    return;
  }

  target.innerHTML = facts.map(function (fact) {
    return (
      "<div>" +
      "<dt>" + escapeHtml(fact.label) + "</dt>" +
      "<dd>" + escapeHtml(fact.value) + "</dd>" +
      "</div>"
    );
  }).join("");
}

function renderBiography(paragraphs) {
  var target = document.getElementById("person-biography");
  if (!target) {
    return;
  }

  if (!paragraphs || !paragraphs.length) {
    target.innerHTML = "<p>" + escapeHtml(t("detail.messages.bioNotAvailable", "No hay biografia disponible.")) + "</p>";
    return;
  }

  target.innerHTML = paragraphs.map(function (paragraph) {
    return "<p>" + escapeHtml(paragraph) + "</p>";
  }).join("");
}

function renderHeroImage(image) {
  var imageElement = document.getElementById("person-image");
  var captionElement = document.getElementById("person-image-caption");
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
  var target = document.getElementById("person-gallery");
  if (!target) {
    return;
  }

  if (!images || !images.length) {
    target.innerHTML = "<p>" + escapeHtml(t("detail.messages.noGalleryImages", "No hay imagenes adicionales.")) + "</p>";
    return;
  }

  target.innerHTML = images.map(function (image) {
    return (
      '<figure class="gallery-card">' +
      '<img src="' + escapeHtml(image.src) + '" alt="' + escapeHtml(image.alt || "") + '">' +
      "<figcaption>" + escapeHtml(image.caption || "") + "</figcaption>" +
      "</figure>"
    );
  }).join("");
}

export function setTreeLink(dataPath, personId) {
  var element = document.getElementById("person-tree-link");
  if (!element) {
    return;
  }

  if (personId) {
    var idParams = new URLSearchParams();
    idParams.set("id", personId);
    element.href = "arbol.html?" + idParams.toString();
    return;
  }

  if (!dataPath) {
    element.href = "arbol.html";
    return;
  }

  var params = new URLSearchParams();
  params.set("data", dataPath);
  element.href = "arbol.html?" + params.toString();
}

export function renderDetailPage(data) {
  var pageDefault = t("detail.title.pageDefault", "Ficha personal");
  var pageSuffix = t("detail.title.suffix", "Familia Minguez - De Antonio");
  document.title = (data.name || pageDefault) + " | " + pageSuffix;
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
