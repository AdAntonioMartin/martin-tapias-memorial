/*
 * Configuracion del sitio. Es el unico fichero que hay que tocar para cambiar
 * el tema, las rutas de datos o los parametros del arbol.
 *
 * Es un script clasico y no un modulo ES a proposito: se carga de forma
 * sincrona en el <head> para que js/theme-boot.js pueda leer el tema antes del
 * primer pintado. Como modulo se ejecutaria diferido, la pagina ya se habria
 * pintado con otro tema y se veria un parpadeo. El resto del codigo lo consume
 * como modulo a traves de js/config/index.js.
 */
window.APP_CONFIG = {
  // Valores soportados: "dark" | "light-celestial" | "dawn-amber" | "auto".
  // "auto" sigue la preferencia del sistema (prefers-color-scheme).
  // Lo que el visitante elija en la pagina tiene prioridad sobre este valor.
  theme: "light-celestial",

  templates: {
    detail: "persona.html",
    tree: "arbol.html",
    listing: "index.html"
  },

  data: {
    listConfig: "data/lista.json",
    peopleIndex: "data/personas-index.json",
    unions: "data/unions.json",
    // Uniones + datos de tarjeta en un solo fichero, generado por tools/build-bundle.mjs.
    treeBundle: "data/tree-bundle.json",
    treeRegistry: "data/trees/index.json",
    uiText: "data/ui-text.es.json"
  },

  tree: {
    transitionMs: 420,
    zoomStep: 1.15,
    zoomTransitionMs: 220,
    cardSpacing: {
      x: 200,
      y: 140
    },
    cardDim: {
      width: 154,
      height: 102,
      img_width: 44,
      img_height: 44,
      img_x: 8,
      img_y: 8
    }
  }
};
