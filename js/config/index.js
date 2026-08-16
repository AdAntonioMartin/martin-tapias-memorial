/*
 * Acceso a la configuracion desde los modulos ES.
 *
 * El valor lo publica js/config/app-config.js, que es un script clasico
 * cargado sincronamente en el <head>. Aqui solo se expone con la misma forma
 * que antes, para que el resto del codigo no tenga que saber nada de esto.
 */

const FALLBACK = {
  siteName: "",
  theme: "light-celestial",
  templates: { detail: "persona.html", tree: "arbol.html", listing: "index.html" },
  data: {},
  tree: {}
};

if (!window.APP_CONFIG) {
  console.error(
    "config: falta js/config/app-config.js en el <head>. Se usan valores por defecto y las rutas de datos no se resolveran."
  );
}

export const APP_CONFIG = window.APP_CONFIG || FALLBACK;

export function getDataConfig() {
  return APP_CONFIG.data;
}

export function getTemplates() {
  return APP_CONFIG.templates;
}

/**
 * Nombre del sitio. Se usa como respaldo cuando no han cargado los textos de
 * interfaz; el codigo no debe llevar escrito el nombre de ninguna familia.
 */
export function getSiteName() {
  return APP_CONFIG.siteName || "";
}

export function getTreeConfig() {
  return APP_CONFIG.tree;
}
