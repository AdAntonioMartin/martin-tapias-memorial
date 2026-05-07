export var APP_CONFIG = {
  // Valores soportados: "dark" | "light-celestial" | "dawn-amber"
  theme: "dark",
  templates: {
    detail: "persona.html"
  },
  data: {
    listConfig: "data/lista.json",
    peopleIndex: "data/personas-index.json",
    treeConfig: "data/arbol.json",
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
