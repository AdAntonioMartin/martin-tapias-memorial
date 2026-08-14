/*
 * Se carga sincronamente desde el <head>, antes de que el navegador pinte.
 *
 * El tema no puede aplicarse desde js/core/theme.js porque type="module" es
 * diferido por definicion: para cuando se ejecuta, la pagina ya se ha pintado
 * con el :root por defecto (oscuro) y salta al tema configurado (claro),
 * produciendo un parpadeo de negro a azul en cada carga.
 *
 * Mantener la lista de temas sincronizada con css/tokens.css y js/core/theme.js.
 */
(function () {
  const THEMES = ["dark", "light-celestial", "dawn-amber"];
  const DEFAULT_THEME = "light-celestial";
  const STORAGE_KEY = "memorial:theme";

  let theme = null;
  try {
    theme = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Almacenamiento no disponible (modo privado, cookies bloqueadas).
  }

  if (THEMES.indexOf(theme) === -1) {
    theme = null;
  }

  if (!theme && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    theme = "dark";
  }

  document.documentElement.setAttribute("data-theme", theme || DEFAULT_THEME);
})();
