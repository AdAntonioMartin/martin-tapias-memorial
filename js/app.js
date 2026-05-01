import { getPageConfig } from "./listing/config.js";
import { loadListConfig, listPersonFiles, loadPersonRecords } from "./listing/data.js";
import { getColumns } from "./listing/columns.js";
import { sortRecords } from "./listing/sort.js";
import { renderTable, renderError } from "./listing/render.js";

function resolvePersonPaths(listConfig) {
  var directory = listConfig.personasPath || "data/personas/";
  var fallbackPaths = Array.isArray(listConfig.personas) ? listConfig.personas : [];

  return listPersonFiles(directory)
    .then(function (paths) {
      return paths.length ? paths : fallbackPaths;
    })
    .catch(function () {
      return fallbackPaths;
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

document.addEventListener("DOMContentLoaded", loadRecords);
