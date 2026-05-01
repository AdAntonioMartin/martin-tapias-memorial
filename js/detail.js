import { getRequestedPersonId, resolveDetailDataPath, loadPersonData } from "./detail/data.js";
import { renderDetailError, renderDetailPage, setTreeLink } from "./detail/render.js";

function loadDetailPage() {
  resolveDetailDataPath()
    .then(function (dataPath) {
      setTreeLink(dataPath, getRequestedPersonId());

      if (!dataPath) {
        renderDetailError("Esta pagina no esta disponible en este momento.");
        return null;
      }

      return loadPersonData(dataPath).then(function (data) {
        setTreeLink(dataPath, data.id || getRequestedPersonId());
        renderDetailPage(data);
        return data;
      });
    })
    .catch(function () {
      renderDetailError("No se pudo mostrar el contenido de esta memoria personal.");
    });
}

document.addEventListener("DOMContentLoaded", loadDetailPage);
