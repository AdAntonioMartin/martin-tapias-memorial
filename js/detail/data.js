import { fetchJson } from "../core/net.js";
import { APP_CONFIG } from "../config/app-config.js";

function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

export function getRequestedTreeKey() {
  return getQueryParams().get("tree") || "";
}

export function getRequestedPersonId() {
  return getQueryParams().get("id");
}

export function getRequestedDataPath() {
  return getQueryParams().get("data");
}

function fetchPersonIndex() {
  var dataConfig = APP_CONFIG && APP_CONFIG.data ? APP_CONFIG.data : {};
  var indexSrc = dataConfig.peopleIndex || "data/personas-index.json";
  var treeRegistry = dataConfig.treeRegistry || "data/trees/index.json";
  var requestedTree = getRequestedTreeKey();

  function normalizeById(payload) {
    return payload && payload.byId && typeof payload.byId === "object" ? payload.byId : {};
  }

  function fetchById(src) {
    return fetchJson(src, "Indice no disponible")
      .then(normalizeById)
      .catch(function () {
        return {};
      });
  }

  if (!requestedTree) {
    return fetchById(indexSrc);
  }

  return fetchJson(treeRegistry)
    .then(function (payload) {
      var trees = payload && Array.isArray(payload.trees) ? payload.trees : [];
      var selected = trees.find(function (entry) {
        return entry && entry.key === requestedTree;
      });
      var selectedIndex = selected && selected.peopleIndex ? selected.peopleIndex : indexSrc;
      return Promise.all([fetchById(indexSrc), fetchById(selectedIndex)]).then(function (all) {
        var fallbackById = all[0] || {};
        var treeById = all[1] || {};
        return Object.assign({}, fallbackById, treeById);
      });
    })
    .catch(function () {
      return fetchById(indexSrc);
    });
}

export function resolveDetailDataPath() {
  var explicitPath = getRequestedDataPath();
  if (explicitPath) {
    return Promise.resolve(explicitPath);
  }

  var personId = getRequestedPersonId();
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

export function loadPersonData(path) {
  return fetchJson(path, "Contenido no disponible").then(function (record) {
    return enrichRecordWithAutoImages(record);
  });
}

var imagesIndexPromiseByTree = {};

function fetchImagesIndex() {
  var requestedTree = getRequestedTreeKey();
  var cacheKey = requestedTree || "__default__";
  if (imagesIndexPromiseByTree[cacheKey]) {
    return imagesIndexPromiseByTree[cacheKey];
  }
  var dataConfig = APP_CONFIG && APP_CONFIG.data ? APP_CONFIG.data : {};
  var fallbackSrc = dataConfig.imagesIndex || "data/trees/global/images-index.json";
  var registrySrc = dataConfig.treeRegistry || "data/trees/index.json";

  imagesIndexPromiseByTree[cacheKey] = (requestedTree
    ? fetchJson(registrySrc)
      .then(function (payload) {
        var trees = payload && Array.isArray(payload.trees) ? payload.trees : [];
        var selected = trees.find(function (entry) {
          return entry && entry.key === requestedTree;
        });
        if (!selected) {
          return fallbackSrc;
        }
        return "data/trees/" + selected.key + "/images-index.json";
      })
      .catch(function () {
        return fallbackSrc;
      })
      .then(function (src) {
        return fetchJson(src).catch(function () { return { bySlug: {} }; });
      })
    : fetchJson(fallbackSrc).catch(function () {
      return { bySlug: {} };
    }));

  return imagesIndexPromiseByTree[cacheKey];
}

function imageCaptionFromFilename(filename) {
  var text = String(filename || "").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return text || "Imagen";
}

function normalizeSrc(src) {
  return String(src || "").replace(/\\/g, "/").trim();
}

function folderFromHeroSrc(record) {
  var src = record && record.heroImage && record.heroImage.src ? normalizeSrc(record.heroImage.src) : "";
  if (!src) {
    return "";
  }
  var slash = src.lastIndexOf("/");
  if (slash <= 0) {
    return "";
  }
  return src.slice(0, slash);
}

function fallbackFolderFromSlug(record) {
  var slug = record && record.slug ? String(record.slug).trim() : "";
  if (!slug) {
    return "";
  }
  return "images/personas/" + slug;
}

function buildAutoImages(record, imagesIndex) {
  var index = imagesIndex && imagesIndex.bySlug && typeof imagesIndex.bySlug === "object" ? imagesIndex.bySlug : {};
  var slug = record && record.slug ? String(record.slug).trim() : "";
  var files = slug && Array.isArray(index[slug]) ? index[slug] : [];
  if (!files.length) {
    return [];
  }
  var folder = folderFromHeroSrc(record) || fallbackFolderFromSlug(record);
  return files.map(function (filename) {
    var cleanName = String(filename || "").trim();
    var caption = imageCaptionFromFilename(cleanName);
    return {
      src: folder + "/" + cleanName,
      alt: "Imagen de " + (record.name || record.id || slug) + ": " + caption,
      caption: caption
    };
  });
}

function enrichRecordWithAutoImages(record) {
  return fetchImagesIndex().then(function (imagesIndex) {
    var data = record && typeof record === "object" ? record : {};
    var explicitGallery = Array.isArray(data.gallery) ? data.gallery.filter(function (item) {
      return item && item.src;
    }) : [];
    var autoGallery = buildAutoImages(data, imagesIndex);

    var seen = {};
    var mergedGallery = [];
    explicitGallery.concat(autoGallery).forEach(function (item) {
      var src = normalizeSrc(item.src);
      if (!src || seen[src]) {
        return;
      }
      seen[src] = true;
      mergedGallery.push(item);
    });

    data.gallery = mergedGallery;

    if (!data.heroImage || !data.heroImage.src) {
      var first = mergedGallery[0] || null;
      data.heroImage = first ? {
        src: first.src,
        alt: first.alt || ("Retrato de " + (data.name || "")),
        caption: first.caption || ""
      } : {
        src: "",
        alt: "",
        caption: ""
      };
    }

    return data;
  });
}
