import { APP_CONFIG } from "../config/app-config.js";

/** Mantener sincronizado con js/theme-boot.js y css/tokens.css. */
export const THEMES = ["dark", "light-celestial", "dawn-amber"];
const STORAGE_KEY = "memorial:theme";

function readStoredTheme() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(stored) ? stored : "";
  } catch {
    return "";
  }
}

function prefersDark() {
  return !!window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function getActiveTheme() {
  return document.documentElement.getAttribute("data-theme") || resolveTheme();
}

function resolveTheme() {
  const stored = readStoredTheme();
  if (stored) {
    return stored;
  }
  if (prefersDark()) {
    return "dark";
  }
  return THEMES.includes(APP_CONFIG.theme) ? APP_CONFIG.theme : "dark";
}

/**
 * theme-boot.js ya ha fijado el atributo antes del primer pintado; esto solo
 * lo reafirma para el caso de que ese script no se haya podido cargar.
 */
export function applyAppTheme() {
  if (!document.documentElement.getAttribute("data-theme")) {
    document.documentElement.setAttribute("data-theme", resolveTheme());
  }
}

export function setTheme(theme) {
  if (!THEMES.includes(theme)) {
    return;
  }
  document.documentElement.setAttribute("data-theme", theme);
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Sin almacenamiento el tema simplemente no persiste entre visitas.
  }
}
