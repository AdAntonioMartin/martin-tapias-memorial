import { APP_CONFIG } from "../config/app-config.js";
import { fetchJson } from "./net.js";

var dictionary = {};

function lookup(path) {
  if (!path) {
    return "";
  }
  return String(path)
    .split(".")
    .reduce(function (acc, key) {
      if (!acc || typeof acc !== "object") {
        return undefined;
      }
      return acc[key];
    }, dictionary);
}

export function t(path, fallback) {
  var value = lookup(path);
  return value === undefined || value === null || value === "" ? (fallback || "") : String(value);
}

export function loadUiText() {
  var dataConfig = APP_CONFIG && APP_CONFIG.data ? APP_CONFIG.data : {};
  var uiTextPath = dataConfig.uiText || "data/ui-text.es.json";
  return fetchJson(uiTextPath)
    .then(function (payload) {
      dictionary = payload && typeof payload === "object" ? payload : {};
      return dictionary;
    })
    .catch(function () {
      dictionary = {};
      return dictionary;
    });
}

export function applyI18nToDom(root) {
  var container = root || document;
  container.querySelectorAll("[data-i18n]").forEach(function (el) {
    var key = el.getAttribute("data-i18n");
    var fallback = el.textContent || "";
    el.textContent = t(key, fallback.trim());
  });
  container.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
    var attrMap = el.getAttribute("data-i18n-attr");
    if (!attrMap) {
      return;
    }
    attrMap.split(";").forEach(function (entry) {
      var pair = entry.split(":");
      if (pair.length !== 2) {
        return;
      }
      var attr = pair[0].trim();
      var key = pair[1].trim();
      if (!attr || !key) {
        return;
      }
      var fallback = el.getAttribute(attr) || "";
      el.setAttribute(attr, t(key, fallback));
    });
  });
}
