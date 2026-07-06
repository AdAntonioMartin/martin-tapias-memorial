import { getRequestedPersonId, getRequestedTreeKey, resolveDetailDataPath, loadPersonData } from "./detail/data.js";
import { renderDetailError, renderDetailPage, setTreeLink } from "./detail/render.js";
import { applyAppTheme } from "./core/theme.js";
import { applyI18nToDom, loadUiText, t } from "./core/i18n.js";

function loadDetailPage() {
  resolveDetailDataPath()
    .then(function (dataPath) {
      setTreeLink(dataPath, getRequestedPersonId(), getRequestedTreeKey());

      if (!dataPath) {
        renderDetailError(t("detail.messages.errorNoPath", "Esta pagina no esta disponible en este momento."));
        return null;
      }

      return loadPersonData(dataPath).then(function (data) {
        setTreeLink(dataPath, data.id || getRequestedPersonId(), getRequestedTreeKey());
        renderDetailPage(data);
        return data;
      });
    })
    .catch(function () {
      renderDetailError(t("detail.messages.errorLoad", "No se pudo mostrar el contenido de esta memoria personal."));
    });
}

applyAppTheme();
document.addEventListener("DOMContentLoaded", function () {
  loadUiText().then(function () {
    applyI18nToDom(document);
    loadDetailPage();
  });
});
