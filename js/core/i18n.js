import { getDataConfig } from "../config/app-config.js";
import { fetchJson } from "./net.js";
import { readPathValue } from "./object.js";

let dictionary = {};

function lookup(path) {
  return readPathValue(dictionary, path);
}

export function t(path, fallback) {
  const value = lookup(path);
  return value === undefined || value === null || value === "" ? fallback || "" : String(value);
}

export function loadUiText() {
  const uiTextPath = getDataConfig().uiText || "data/ui-text.es.json";
  return fetchJson(uiTextPath)
    .then((payload) => {
      dictionary = payload && typeof payload === "object" ? payload : {};
      return dictionary;
    })
    .catch(() => {
      dictionary = {};
      return dictionary;
    });
}

export function applyI18nToDom(root) {
  const container = root || document;
  container.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const fallback = el.textContent || "";
    el.textContent = t(key, fallback.trim());
  });
  container.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    const attrMap = el.getAttribute("data-i18n-attr");
    if (!attrMap) {
      return;
    }
    attrMap.split(";").forEach((entry) => {
      const pair = entry.split(":");
      if (pair.length !== 2) {
        return;
      }
      const attr = pair[0].trim();
      const key = pair[1].trim();
      if (!attr || !key) {
        return;
      }
      const fallback = el.getAttribute(attr) || "";
      el.setAttribute(attr, t(key, fallback));
    });
  });
}
