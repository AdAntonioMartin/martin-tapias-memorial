function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

function getDetailDataPath() {
  return getQueryParams().get("data");
}

function getDetailPersonId() {
  return getQueryParams().get("id");
}

function fetchPersonIndex() {
  return fetch("data/personas-index.json")
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Indice no disponible");
      }
      return response.json();
    })
    .then(function (payload) {
      return payload && payload.byId && typeof payload.byId === "object" ? payload.byId : {};
    });
}

function resolveDetailDataPath() {
  var directPath = getDetailDataPath();
  if (directPath) {
    return Promise.resolve(directPath);
  }

  var personId = getDetailPersonId();
  if (!personId) {
    return Promise.resolve(null);
  }

  return fetchPersonIndex()
    .then(function (byId) {
      return byId[personId] || null;
    })
    .catch(function () {
      return null;
    });
}

function setText(id, value) {
  var element = document.getElementById(id);
  if (element) {
    element.textContent = value || "";
  }
}

function setTreeLink(dataPath, personId) {
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

function renderFacts(facts) {
  var target = document.getElementById("person-facts");
  if (!target) {
    return;
  }

  if (!facts || !facts.length) {
    target.innerHTML = "<div><dt>Informacion</dt><dd>No disponible.</dd></div>";
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
    target.innerHTML = "<p>No hay biografia disponible.</p>";
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
    captionElement.textContent = "Sin imagen principal.";
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
    target.innerHTML = "<p>No hay imagenes adicionales.</p>";
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

function renderDetailPage(data) {
  document.title = (data.name || "Ficha personal") + " | Familia Minguez - De Antonio";
  setText("person-name", data.name || "Ficha personal");
  setText("person-subtitle", data.subtitle || "");
  setText("person-summary", data.summary || "");
  renderFacts(data.facts);
  renderHeroImage(data.heroImage);
  renderBiography(data.biography);
  renderGallery(data.gallery);
}

function renderError(message) {
  setText("person-name", "No se pudo mostrar esta ficha");
  setText("person-subtitle", "");
  setText("person-summary", message);
  renderFacts([]);
  renderHeroImage(null);
  renderBiography([]);
  renderGallery([]);
}

function loadDetailPage() {
  resolveDetailDataPath()
    .then(function (dataPath) {
      setTreeLink(dataPath, getDetailPersonId());

      if (!dataPath) {
        renderError("Esta pagina no esta disponible en este momento.");
        return;
      }

      return fetch(dataPath)
        .then(function (response) {
          if (!response.ok) {
            throw new Error("Contenido no disponible");
          }

          return response.json();
        })
        .then(function (data) {
          setTreeLink(dataPath, data.id || getDetailPersonId());
          renderDetailPage(data);
        });
    })
    .catch(function () {
      renderError("No se pudo mostrar el contenido de esta memoria personal.");
    });
}

document.addEventListener("DOMContentLoaded", loadDetailPage);
