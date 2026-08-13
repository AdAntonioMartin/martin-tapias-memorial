import { getRequestedPersonId, getRequestedTreeKey, resolveDetailDataPath, loadPersonData } from "./detail/data.js";
import { renderDetailError, renderDetailPage, setTreeLink } from "./detail/render.js";
import { bootstrapPage } from "./core/bootstrap.js";
import { t } from "./core/i18n.js";

function loadDetailPage() {
  resolveDetailDataPath()
    .then((dataPath) => {
      setTreeLink(dataPath, getRequestedPersonId(), getRequestedTreeKey());

      if (!dataPath) {
        renderDetailError(t("detail.messages.errorNoPath", "Esta pagina no esta disponible en este momento."));
        return null;
      }

      return loadPersonData(dataPath).then((data) => {
        setTreeLink(dataPath, data.id || getRequestedPersonId(), getRequestedTreeKey());
        renderDetailPage(data);
        return data;
      });
    })
    .catch(() => {
      renderDetailError(t("detail.messages.errorLoad", "No se pudo mostrar el contenido de esta memoria personal."));
    });
}

bootstrapPage(loadDetailPage);
