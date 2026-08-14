import { fetchJson } from "../core/net.js";
import { loadByIdIndex } from "../core/dataIndex.js";
import { getDataConfig } from "../config/app-config.js";

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

function findTreeEntry(registryPayload, key) {
  const trees = registryPayload && Array.isArray(registryPayload.trees) ? registryPayload.trees : [];
  return trees.find((entry) => entry && entry.key === key) || null;
}

function fetchPersonIndex() {
  const dataConfig = getDataConfig();
  const indexSrc = dataConfig.peopleIndex || "data/personas-index.json";
  const treeRegistry = dataConfig.treeRegistry || "data/trees/index.json";
  const requestedTree = getRequestedTreeKey();

  if (!requestedTree) {
    return loadByIdIndex(indexSrc);
  }

  return fetchJson(treeRegistry)
    .then((payload) => {
      const selected = findTreeEntry(payload, requestedTree);
      const selectedIndex = selected && selected.peopleIndex ? selected.peopleIndex : indexSrc;
      return Promise.all([loadByIdIndex(indexSrc), loadByIdIndex(selectedIndex)]).then(
        ([fallbackById, treeById]) => Object.assign({}, fallbackById, treeById)
      );
    })
    .catch(() => loadByIdIndex(indexSrc));
}

export function resolveDetailDataPath() {
  const explicitPath = getRequestedDataPath();
  if (explicitPath) {
    return Promise.resolve(explicitPath);
  }

  const personId = getRequestedPersonId();
  if (!personId) {
    return Promise.resolve(null);
  }

  return fetchPersonIndex()
    .then((byId) => byId[personId] || null)
    .catch(() => null);
}

export function loadPersonData(path) {
  return fetchJson(path, "Contenido no disponible").then((record) => enrichRecordWithAutoImages(record));
}

const imagesIndexPromiseByTree = {};

function fetchImagesIndex() {
  const requestedTree = getRequestedTreeKey();
  const cacheKey = requestedTree || "__default__";
  if (imagesIndexPromiseByTree[cacheKey]) {
    return imagesIndexPromiseByTree[cacheKey];
  }
  const dataConfig = getDataConfig();
  const fallbackSrc = dataConfig.imagesIndex || "data/trees/global/images-index.json";
  const registrySrc = dataConfig.treeRegistry || "data/trees/index.json";

  imagesIndexPromiseByTree[cacheKey] = requestedTree
    ? fetchJson(registrySrc)
        .then((payload) => {
          const selected = findTreeEntry(payload, requestedTree);
          return selected ? `data/trees/${selected.key}/images-index.json` : fallbackSrc;
        })
        .catch(() => fallbackSrc)
        .then((src) => fetchJson(src).catch(() => ({ bySlug: {} })))
    : fetchJson(fallbackSrc).catch(() => ({ bySlug: {} }));

  return imagesIndexPromiseByTree[cacheKey];
}

function imageCaptionFromFilename(filename) {
  const text = String(filename || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
  return text || "Imagen";
}

function normalizeSrc(src) {
  return String(src || "")
    .replace(/\\/g, "/")
    .trim();
}

function folderFromHeroSrc(record) {
  const src = record && record.heroImage && record.heroImage.src ? normalizeSrc(record.heroImage.src) : "";
  if (!src) {
    return "";
  }
  const slash = src.lastIndexOf("/");
  if (slash <= 0) {
    return "";
  }
  return src.slice(0, slash);
}

function fallbackFolderFromSlug(record) {
  const slug = record && record.slug ? String(record.slug).trim() : "";
  return slug ? `images/personas/${slug}` : "";
}

function buildAutoImages(record, imagesIndex) {
  const index =
    imagesIndex && imagesIndex.bySlug && typeof imagesIndex.bySlug === "object" ? imagesIndex.bySlug : {};
  const slug = record && record.slug ? String(record.slug).trim() : "";
  const files = slug && Array.isArray(index[slug]) ? index[slug] : [];
  if (!files.length) {
    return [];
  }
  const folder = folderFromHeroSrc(record) || fallbackFolderFromSlug(record);
  return files.map((filename) => {
    const cleanName = String(filename || "").trim();
    const caption = imageCaptionFromFilename(cleanName);
    return {
      src: `${folder}/${cleanName}`,
      alt: `Imagen de ${record.name || record.id || slug}: ${caption}`,
      caption
    };
  });
}

function enrichRecordWithAutoImages(record) {
  return fetchImagesIndex().then((imagesIndex) => {
    const data = record && typeof record === "object" ? record : {};
    const explicitGallery = Array.isArray(data.gallery)
      ? data.gallery.filter((item) => item && item.src)
      : [];
    const autoGallery = buildAutoImages(data, imagesIndex);

    const seen = {};
    const mergedGallery = [];
    explicitGallery.concat(autoGallery).forEach((item) => {
      const src = normalizeSrc(item.src);
      if (!src || seen[src]) {
        return;
      }
      seen[src] = true;
      mergedGallery.push(item);
    });

    data.gallery = mergedGallery;

    if (!data.heroImage || !data.heroImage.src) {
      const first = mergedGallery[0] || null;
      data.heroImage = first
        ? {
            src: first.src,
            alt: first.alt || `Retrato de ${data.name || ""}`,
            caption: first.caption || ""
          }
        : {
            src: "",
            alt: "",
            caption: ""
          };
    }

    return data;
  });
}
