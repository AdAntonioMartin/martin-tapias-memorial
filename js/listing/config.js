import { APP_CONFIG } from "../config/app-config.js";

export function getPageConfig() {
  var page = document.querySelector(".page");
  var defaults = APP_CONFIG || {};
  var dataConfig = defaults.data || {};
  var templates = defaults.templates || {};
  return {
    listSrc: (page && page.dataset.recordsSrc) || dataConfig.listConfig || "data/lista.json",
    detailTemplate: (page && page.dataset.detailTemplate) || templates.detail || "persona.html"
  };
}
