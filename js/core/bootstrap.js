import { applyAppTheme } from "./theme.js";
import { applyI18nToDom, loadUiText } from "./i18n.js";

export function bootstrapPage(initFn) {
  applyAppTheme();
  document.addEventListener("DOMContentLoaded", () => {
    loadUiText().then(() => {
      applyI18nToDom(document);
      initFn();
    });
  });
}
