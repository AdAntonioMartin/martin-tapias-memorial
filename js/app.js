import { getPageConfig } from "./listing/config.js";
import { loadListConfig, listPersonFiles, loadPersonRecords, loadPersonPathsFromIndex } from "./listing/data.js";
import { getColumns } from "./listing/columns.js";
import { sortRecords } from "./listing/sort.js";
import { renderTable, renderError } from "./listing/render.js";
import { applyAppTheme } from "./core/theme.js";
import { applyI18nToDom, loadUiText } from "./core/i18n.js";

function resolvePersonPaths(listConfig) {
  var directory = listConfig.personasPath || "";
  var configuredPaths = Array.isArray(listConfig.personas) ? listConfig.personas.filter(Boolean) : [];

  if (configuredPaths.length) {
    return Promise.resolve(configuredPaths);
  }

  return loadPersonPathsFromIndex()
    .then(function (indexPaths) {
      var fallbacks = indexPaths;
      if (!directory) {
        return fallbacks;
      }
      return listPersonFiles(directory)
        .then(function (paths) {
          return paths.length ? paths : fallbacks;
        })
        .catch(function () {
          return fallbacks;
        });
    });
}

function loadRecords() {
  var pageConfig = getPageConfig();

  loadListConfig(pageConfig.listSrc)
    .then(function (listConfig) {
      return resolvePersonPaths(listConfig)
        .then(loadPersonRecords)
        .then(function (records) {
          var mergedConfig = {
            columns: listConfig.columns,
            sort: listConfig.sort,
            detailTemplate: listConfig.detailTemplate || pageConfig.detailTemplate
          };
          var columns = getColumns(records, mergedConfig.columns);
          return {
            records: sortRecords(records, mergedConfig.sort, columns),
            columns: columns,
            config: mergedConfig
          };
        });
    })
    .then(function (payload) {
      renderTable(payload.records, payload.columns, payload.config);
    })
    .catch(renderError);
}

applyAppTheme();
document.addEventListener("DOMContentLoaded", function () {
  loadUiText().then(function () {
    applyI18nToDom(document);
    loadRecords();
  });
});
