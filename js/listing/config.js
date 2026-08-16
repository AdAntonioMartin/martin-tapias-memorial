import { getDataConfig, getTemplates } from "../config/index.js";

export function getPageConfig() {
  return {
    listSrc: getDataConfig().listConfig,
    detailTemplate: getTemplates().detail
  };
}
