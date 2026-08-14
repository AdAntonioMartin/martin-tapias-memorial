export const APP_CONFIG = {
  // Valores soportados: "dark" | "light-celestial" | "dawn-amber"
  theme: "light-celestial",
  templates: {
    detail: "persona.html",
    tree: "arbol.html",
    listing: "index.html"
  },
  data: {
    listConfig: "data/lista.json",
    peopleIndex: "data/personas-index.json",
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

export function getDataConfig() {
  return APP_CONFIG.data;
}

export function getTemplates() {
  return APP_CONFIG.templates;
}

export function getTreeConfig() {
  return APP_CONFIG.tree;
}
