import { getRequestedPersonId, resolveDetailDataPath, loadPersonData } from "./detail/data.js";
import { renderDetailError, renderDetailPage, setTreeLink } from "./detail/render.js";
import { bootstrapPage } from "./core/bootstrap.js";
import { getTreeKeyFromUrl } from "./core/url.js";
import { t } from "./core/i18n.js";

function loadDetailPage() {
  const treeKey = getTreeKeyFromUrl();

  resolveDetailDataPath()
    .then((dataPath) => {
      if (!dataPath) {
        setTreeLink(dataPath, getRequestedPersonId(), treeKey);
        renderDetailError(
          t("detail.messages.errorNoPath", "Esta pagina no esta disponible en este momento.")
        );
        return null;
      }

      return loadPersonData(dataPath).then((data) => {
        setTreeLink(dataPath, data.id || getRequestedPersonId(), treeKey);
        renderDetailPage(data);
        return data;
      });
    })
    .catch((error) => {
      console.error("detail.js:", error);
      renderDetailError(
        t("detail.messages.errorLoad", "No se pudo mostrar el contenido de esta memoria personal.")
      );
    });
}

bootstrapPage(loadDetailPage);
