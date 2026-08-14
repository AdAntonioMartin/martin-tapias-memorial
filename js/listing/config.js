import { getDataConfig, getTemplates } from "../config/app-config.js";

export function getPageConfig() {
  return {
    listSrc: getDataConfig().listConfig,
    detailTemplate: getTemplates().detail
  };
}
