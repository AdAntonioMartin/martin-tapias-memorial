import { APP_CONFIG } from "../config/index.js";

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

function systemTheme() {
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light-celestial";
}

/** Misma prioridad que js/theme-boot.js: eleccion del visitante, luego configuracion, luego sistema. */
function resolveTheme() {
  const chosen = readStoredTheme();
  if (chosen) {
    return chosen;
  }
  if (APP_CONFIG.theme === "auto") {
    return systemTheme();
  }
  return THEMES.includes(APP_CONFIG.theme) ? APP_CONFIG.theme : systemTheme();
}

export function getActiveTheme() {
  return document.documentElement.getAttribute("data-theme") || resolveTheme();
}

/**
 * theme-boot.js ya ha fijado el atributo antes del primer pintado. Esto solo
 * cubre el caso de que ese script no se haya podido cargar.
 */
export function applyAppTheme() {
  if (!document.documentElement.getAttribute("data-theme")) {
    document.documentElement.setAttribute("data-theme", resolveTheme());
  }
}

/** Guarda la eleccion del visitante, que a partir de ahi gana sobre la configuracion. */
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

/** Vuelve a lo que diga APP_CONFIG, descartando la eleccion guardada. */
export function clearThemeChoice() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada que limpiar.
  }
  document.documentElement.setAttribute("data-theme", resolveTheme());
}
