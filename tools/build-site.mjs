/**
 * Construye los ficheros del sitio que dependen de site.config.json.
 *
 * Existe para que el codigo no sepa a que familia pertenece: el nombre, el
 * dominio y el tema viven en site.config.json, y de ahi salen los ficheros
 * generados. Asi el mismo motor sirve para cualquier memorial.
 *
 * Genera:
 *   js/config/app-config.js   configuracion en tiempo de ejecucion
 *   index.html, arbol.html, persona.html   desde templates/
 *   data/ui-text.es.json      textos del motor + los del sitio
 *
 *   node tools/build-site.mjs [--check]
 *
 * Con --check no escribe: falla si lo que hay en disco no coincide con lo que
 * se generaria. Es lo que ejecuta CI para detectar ficheros generados a mano o
 * desactualizados.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";
import { escapeHtml } from "../js/core/html.js";
import { deepMerge, loadSiteConfig, resolveAppConfig, siteRoot } from "./lib/site-config.mjs";

const ENGINE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULTS_DIR = path.join(ENGINE_ROOT, "defaults");
const TEMPLATES_DIR = path.join(ENGINE_ROOT, "templates");
const CHECK_ONLY = process.argv.includes("--check");
const PAGES = ["index.html", "arbol.html", "persona.html"];

const GENERATED_NOTICE = "GENERADO por tools/build-site.mjs a partir de site.config.json. No editar a mano.";

/**
 * app-config.js tiene que seguir siendo un script clasico y no un modulo ES:
 * se carga sincrono en el <head> para que js/theme-boot.js aplique el tema
 * antes del primer pintado. Como modulo se ejecutaria diferido y volveria el
 * parpadeo en cada carga.
 */
function renderAppConfig(appConfig) {
  const themes = Object.keys(appConfig.themeColors || {}).join(" | ");
  const header = [
    "/*",
    ` * ${GENERATED_NOTICE}`,
    " *",
    " * Para cambiar el tema se edita site.config.json, no este fichero.",
    ` * Valores admitidos: ${themes} | auto. "auto" sigue la preferencia del`,
    " * sistema; lo que el visitante elija en la pagina tiene prioridad sobre ambos.",
    " *",
    " * Es un script clasico y no un modulo ES a proposito: se carga de forma",
    " * sincrona en el <head> para que js/theme-boot.js pueda leer el tema antes",
    " * del primer pintado. El resto del codigo lo consume como modulo a traves",
    " * de js/config/index.js.",
    " */"
  ].join("\n");

  return `${header}\nwindow.APP_CONFIG = ${JSON.stringify(appConfig, null, 2)};\n`;
}

/**
 * Sustituye {{clave}} y {{clave.anidada}} por los valores del sitio.
 *
 * `transform` decide como se inserta cada valor y no es un detalle menor:
 * en las plantillas HTML se escapa, porque el nombre o la descripcion acaban
 * dentro de un atributo y un apostrofe o un & lo romperian; en los textos de
 * interfaz se inserta en crudo, porque applyI18nToDom los pinta con textContent
 * y un valor escapado se veria literal en pantalla.
 *
 * Un marcador sin valor es un error y no un hueco vacio: siempre es una errata
 * en la plantilla o una clave que falta en la configuracion.
 */
function substitute(source, values, where, transform, missing) {
  return source.replace(/\{\{([\w.]+)\}\}/g, (_match, key) => {
    const value = key.split(".").reduce((current, part) => {
      return current && Object.prototype.hasOwnProperty.call(current, part) ? current[part] : undefined;
    }, values);

    if (value === undefined || value === null || value === "") {
      missing.add(`${where}: {{${key}}}`);
      return "";
    }
    return transform(value);
  });
}

function assertNothingMissing(missing) {
  if (missing.size) {
    throw new Error(`Sin valor para:\n  ${[...missing].join("\n  ")}`);
  }
}

function renderTemplate(source, values, templateName) {
  const missing = new Set();
  const rendered = substitute(source, values, templateName, escapeHtml, missing);
  assertNothingMissing(missing);
  return rendered;
}

/**
 * Recorre una estructura ya parseada y sustituye los marcadores de cada cadena.
 * Se hace sobre el objeto y no sobre el texto del JSON para que el escapado de
 * comillas y barras lo resuelva JSON.stringify al serializar.
 */
function substituteInJson(node, values, where, missing) {
  if (typeof node === "string") {
    return substitute(node, values, where, (value) => String(value), missing);
  }
  if (Array.isArray(node)) {
    return node.map((item) => substituteInJson(item, values, where, missing));
  }
  if (node && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [key, substituteInJson(value, values, where, missing)])
    );
  }
  return node;
}

/**
 * Textos de interfaz: los del motor mas lo que el sitio quiera cambiar.
 *
 * Casi todo es chrome ("Saltar al contenido", "Cargando datos...") y vive en
 * defaults/, de forma que al mejorar un texto lo hereden todos los memoriales.
 * Lo unico propio de cada sitio es el nombre, que entra por {{siteName}}, asi
 * que una familia nueva no tiene que escribir ni un texto para empezar.
 *
 * site-text.es.json es opcional y solo hace falta para reescribir algun texto
 * concreto; se fusiona en profundidad sobre los del motor.
 */
async function renderUiText(root, values) {
  const defaults = JSON.parse(await readFile(path.join(DEFAULTS_DIR, "ui-text.es.json"), "utf8"));
  const overridePath = path.join(root, "site-text.es.json");
  const merged = existsSync(overridePath)
    ? deepMerge(defaults, JSON.parse(await readFile(overridePath, "utf8")))
    : defaults;

  const missing = new Set();
  const resolved = substituteInJson(merged, values, "defaults/ui-text.es.json", missing);
  assertNothingMissing(missing);

  return `${JSON.stringify(resolved, null, 2)}\n`;
}

/** Respeta el .prettierrc del sitio para que el HTML generado no lo contradiga. */
async function resolvePrettierOptions(root) {
  const configPath = path.join(root, ".prettierrc.json");
  return existsSync(configPath) ? JSON.parse(await readFile(configPath, "utf8")) : {};
}

/** Devuelve true si el fichero ya tenia ese contenido exacto. */
async function writeGenerated(absPath, content, results) {
  const rel = path.relative(siteRoot(), absPath).split(path.sep).join("/");
  const current = existsSync(absPath) ? await readFile(absPath, "utf8") : null;

  if (current === content) {
    results.unchanged.push(rel);
    return;
  }
  if (CHECK_ONLY) {
    results.stale.push(rel);
    return;
  }
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, content, "utf8");
  results.written.push(rel);
}

async function main() {
  const root = siteRoot();
  const site = await loadSiteConfig(root);
  const appConfig = await resolveAppConfig(site, DEFAULTS_DIR);
  const results = { written: [], unchanged: [], stale: [] };

  // Se pasa prettier a todo lo generado para que el resultado sea canonico sea
  // cual sea la configuracion del sitio, y `npm run format:check` siga pasando
  // sobre los ficheros que quedan en la raiz y en js/.
  const prettierOptions = await resolvePrettierOptions(root);
  const prettify = (source, parser) => format(source, { ...prettierOptions, parser });

  await writeGenerated(
    path.join(root, "js", "config", "app-config.js"),
    await prettify(renderAppConfig(appConfig), "babel"),
    results
  );

  const values = {
    siteName: site.siteName,
    description: site.description,
    descriptions: site.descriptions,
    baseUrl: site.baseUrl,
    lang: site.lang,
    favicon: site.favicon,
    // Valor inicial de la barra de direcciones. js/theme-boot.js lo reajusta si
    // el visitante tiene otro tema guardado; ambos leen el mismo mapa.
    themeColor: (appConfig.themeColors || {})[appConfig.theme] || ""
  };

  for (const page of PAGES) {
    const source = await readFile(path.join(TEMPLATES_DIR, page), "utf8");
    const html = await prettify(renderTemplate(source, values, `templates/${page}`), "html");
    await writeGenerated(path.join(root, page), html, results);
  }

  await writeGenerated(
    path.join(root, appConfig.data.uiText),
    await prettify(await renderUiText(root, values), "json"),
    results
  );

  if (CHECK_ONLY && results.stale.length) {
    console.error("Ficheros generados desactualizados:");
    results.stale.forEach((rel) => console.error(`  ${rel}`));
    console.error("\nEjecuta `npm run build` y commitea el resultado.");
    process.exitCode = 1;
    return;
  }

  console.log(`Sitio: ${site.siteName} (${site.baseUrl})`);
  if (CHECK_ONLY) {
    console.log(`${results.unchanged.length} ficheros generados al dia.`);
    return;
  }
  console.log(`Generados: ${results.written.length}, sin cambios: ${results.unchanged.length}`);
  results.written.forEach((rel) => console.log(`  ${rel}`));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
