/*
 * GENERADO por tools/build-site.mjs a partir de site.config.json. No editar a mano.
 *
 * Para cambiar el tema se edita site.config.json, no este fichero.
 * Valores admitidos: dark | light-celestial | dawn-amber | auto. "auto" sigue la preferencia del
 * sistema; lo que el visitante elija en la pagina tiene prioridad sobre ambos.
 *
 * Es un script clasico y no un modulo ES a proposito: se carga de forma
 * sincrona en el <head> para que js/theme-boot.js pueda leer el tema antes
 * del primer pintado. El resto del codigo lo consume como modulo a traves
 * de js/config/index.js.
 */
window.APP_CONFIG = {
  theme: "light-celestial",
  themeColors: {
    dark: "#11100f",
    "light-celestial": "#eef5ff",
    "dawn-amber": "#f6efe6"
  },
  templates: {
    detail: "persona.html",
    tree: "arbol.html",
    listing: "index.html"
  },
  data: {
    listConfig: "data/lista.json",
    peopleIndex: "data/personas-index.json",
    unions: "data/unions.json",
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
  },
  siteName: "Familia Martín - Tapias"
};
