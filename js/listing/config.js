import { APP_CONFIG } from "../config/app-config.js";

export function getPageConfig() {
  const page = document.querySelector(".page");
  const defaults = APP_CONFIG || {};
  const dataConfig = defaults.data || {};
  const templates = defaults.templates || {};
  return {
    listSrc: (page && page.dataset.recordsSrc) || dataConfig.listConfig || "data/lista.json",
    detailTemplate: (page && page.dataset.detailTemplate) || templates.detail || "persona.html"
  };
}
