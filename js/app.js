import { getPageConfig } from "./listing/config.js";
import { loadListConfig, loadPersonRecords, loadPersonPathsFromIndex } from "./listing/data.js";
import { getColumns } from "./listing/columns.js";
import { sortRecords } from "./listing/sort.js";
import { renderTable, renderError } from "./listing/render.js";
import { bootstrapPage } from "./core/bootstrap.js";

function resolvePersonPaths(listConfig) {
  const configuredPaths = Array.isArray(listConfig.personas) ? listConfig.personas.filter(Boolean) : [];
  return configuredPaths.length ? Promise.resolve(configuredPaths) : loadPersonPathsFromIndex();
}

function loadRecords() {
  const pageConfig = getPageConfig();

  loadListConfig(pageConfig.listSrc)
    .then((listConfig) =>
      resolvePersonPaths(listConfig)
        .then(loadPersonRecords)
        .then(({ records, failed }) => {
          const mergedConfig = {
            columns: listConfig.columns,
            sort: listConfig.sort,
            detailTemplate: listConfig.detailTemplate || pageConfig.detailTemplate
          };
          const columns = getColumns(records, mergedConfig.columns);
          return {
            records: sortRecords(records, mergedConfig.sort, columns),
            columns,
            config: mergedConfig,
            failed
          };
        })
    )
    .then((payload) => {
      renderTable(payload.records, payload.columns, payload.config, payload.failed);
    })
    .catch((error) => {
      console.error("app.js:", error);
      renderError();
    });
}

bootstrapPage(loadRecords);
