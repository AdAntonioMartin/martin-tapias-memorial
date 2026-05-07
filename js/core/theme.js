import { APP_CONFIG } from "../config/app-config.js";

var THEMES = {
  dark: true,
  "light-celestial": true,
  "dawn-amber": true
};

export function applyAppTheme() {
  var theme = APP_CONFIG && APP_CONFIG.theme ? APP_CONFIG.theme : "dark";
  if (!THEMES[theme]) {
    theme = "dark";
  }

  var root = document.documentElement;
  root.setAttribute("data-theme", theme);
}
