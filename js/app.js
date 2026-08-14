import { getPageConfig } from "./listing/config.js";
import {
  loadListConfig,
  listPersonFiles,
  loadPersonRecords,
  loadPersonPathsFromIndex
} from "./listing/data.js";
import { getColumns } from "./listing/columns.js";
import { sortRecords } from "./listing/sort.js";
import { renderTable, renderError } from "./listing/render.js";
import { bootstrapPage } from "./core/bootstrap.js";

function resolvePersonPaths(listConfig) {
  const directory = listConfig.personasPath || "";
  const configuredPaths = Array.isArray(listConfig.personas) ? listConfig.personas.filter(Boolean) : [];

  if (configuredPaths.length) {
    return Promise.resolve(configuredPaths);
  }

  return loadPersonPathsFromIndex().then((fallbacks) => {
    if (!directory) {
      return fallbacks;
    }
    return listPersonFiles(directory)
      .then((paths) => (paths.length ? paths : fallbacks))
      .catch(() => fallbacks);
  });
}

function loadRecords() {
  const pageConfig = getPageConfig();

  loadListConfig(pageConfig.listSrc)
    .then((listConfig) =>
      resolvePersonPaths(listConfig)
        .then(loadPersonRecords)
        .then((records) => {
          const mergedConfig = {
            columns: listConfig.columns,
            sort: listConfig.sort,
            detailTemplate: listConfig.detailTemplate || pageConfig.detailTemplate
          };
          const columns = getColumns(records, mergedConfig.columns);
          return {
            records: sortRecords(records, mergedConfig.sort, columns),
            columns,
            config: mergedConfig
          };
        })
    )
    .then((payload) => {
      renderTable(payload.records, payload.columns, payload.config);
    })
    .catch(renderError);
}

bootstrapPage(loadRecords);
