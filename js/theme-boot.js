/*
 * Resuelve y aplica el tema antes de que el navegador pinte.
 *
 * Se carga sincronamente en el <head>, justo despues de js/config/app-config.js.
 * No puede hacerse desde js/core/theme.js porque type="module" es diferido por
 * definicion: para cuando se ejecuta, la pagina ya se ha pintado con el tema
 * anterior y se ve un parpadeo.
 *
 * Orden de prioridad:
 *   1. Lo que el visitante haya elegido en la pagina (localStorage).
 *   2. APP_CONFIG.theme, que es la decision de diseno del sitio.
 *   3. La preferencia del sistema, solo si APP_CONFIG.theme vale "auto".
 *
 * Mantener THEMES sincronizado con css/tokens.css y js/core/theme.js.
 */
(function () {
  const THEMES = ["dark", "light-celestial", "dawn-amber"];
  const STORAGE_KEY = "memorial:theme";
  const config = window.APP_CONFIG || {};

  function fromStorage() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return THEMES.indexOf(stored) !== -1 ? stored : "";
    } catch {
      // Almacenamiento no disponible (modo privado, cookies bloqueadas).
      return "";
    }
  }

  function fromSystem() {
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light-celestial";
  }

  function resolve() {
    const chosen = fromStorage();
    if (chosen) {
      return chosen;
    }
    const configured = config.theme;
    if (configured === "auto") {
      return fromSystem();
    }
    if (THEMES.indexOf(configured) !== -1) {
      return configured;
    }
    if (configured) {
      console.error(`theme: "${configured}" no es un tema valido. Usa uno de: ${THEMES.join(", ")}, auto.`);
    }
    return fromSystem();
  }

  /*
   * Color de la barra de direcciones en movil, por tema. Sale de la
   * configuracion para que el valor inicial que escribe el generador en el HTML
   * y el que se aplica aqui no puedan divergir. El respaldo cubre el caso de
   * que falte app-config.js.
   */
  const THEME_COLORS = config.themeColors || {
    dark: "#11100f",
    "light-celestial": "#eef5ff",
    "dawn-amber": "#f6efe6"
  };

  const theme = resolve();
  document.documentElement.setAttribute("data-theme", theme);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && THEME_COLORS[theme]) {
    meta.setAttribute("content", THEME_COLORS[theme]);
  }
})();
