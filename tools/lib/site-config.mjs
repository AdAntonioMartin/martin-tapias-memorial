/**
 * Lectura de la configuracion del sitio, compartida por los scripts de tools/.
 *
 * site.config.json guarda lo que distingue a este sitio de cualquier otro
 * memorial (nombre, dominio, idioma, tema). defaults/ guarda lo que es igual
 * para todos y viaja con el motor. Ningun script debe llevar a fuego el nombre
 * de una familia ni una URL: todo sale de aqui.
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * Fusion profunda: los objetos se recorren, y arrays y escalares se sustituyen
 * enteros. Se usa para que el sitio solo tenga que declarar lo que cambia
 * respecto a los valores por defecto del motor.
 */
export function deepMerge(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override === undefined ? base : override;
  }
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = isPlainObject(value) && isPlainObject(base[key]) ? deepMerge(base[key], value) : value;
  }
  return result;
}

const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));

/**
 * Raiz del sitio. Es process.cwd() y no la ubicacion de este fichero porque los
 * scripts se ejecutan desde el repositorio de datos, mientras que el codigo
 * puede vivir en node_modules.
 */
export function siteRoot() {
  return process.cwd();
}

export async function loadSiteConfig(root = siteRoot()) {
  const configPath = path.join(root, "site.config.json");
  if (!existsSync(configPath)) {
    throw new Error(
      `No existe site.config.json en ${root}. Es obligatorio: define el nombre del sitio, el dominio y el tema.`
    );
  }

  const site = await readJson(configPath);
  for (const field of ["siteName", "baseUrl"]) {
    if (!String(site[field] || "").trim()) {
      throw new Error(`site.config.json: falta "${field}"`);
    }
  }

  const description = String(site.description || "");
  const perPage = isPlainObject(site.descriptions) ? site.descriptions : {};

  return {
    siteName: site.siteName,
    description,
    // Cada pagina cae en la descripcion general si no declara la suya.
    descriptions: {
      listing: String(perPage.listing || description),
      tree: String(perPage.tree || description),
      detail: String(perPage.detail || description)
    },
    baseUrl: String(site.baseUrl).replace(/\/+$/, ""),
    lang: String(site.lang || "es"),
    theme: String(site.theme || ""),
    favicon: String(site.favicon || "images/retrato.svg"),
    overrides: isPlainObject(site.overrides) ? site.overrides : {}
  };
}

/**
 * Valores por defecto del motor, fusionados con lo que declare el sitio.
 *
 * siteName viaja tambien aqui, y no solo en los textos de interfaz, para que el
 * codigo tenga un respaldo con el nombre correcto cuando falle la carga de
 * data/ui-text.es.json. Antes ese respaldo era una cadena fija con el nombre de
 * una familia concreta dentro de js/detail/render.js.
 */
export async function resolveAppConfig(site, defaultsDir) {
  const defaults = await readJson(path.join(defaultsDir, "app-config.json"));
  const withSite = deepMerge(defaults, {
    siteName: site.siteName,
    ...(site.theme ? { theme: site.theme } : {})
  });
  return deepMerge(withSite, site.overrides);
}
