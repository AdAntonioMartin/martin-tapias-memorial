import { APP_CONFIG } from "../config/app-config.js";

const THEMES = ["dark", "light-celestial", "dawn-amber"];

export function applyAppTheme() {
  let theme = APP_CONFIG && APP_CONFIG.theme ? APP_CONFIG.theme : "dark";
  if (!THEMES.includes(theme)) {
    theme = "dark";
  }

  document.documentElement.setAttribute("data-theme", theme);
}
