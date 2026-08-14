/**
 * Prueba de humo en navegador real.
 *
 * Levanta las tres paginas, cuenta peticiones, recoge errores de consola y
 * comprueba lo que las pruebas unitarias no pueden ver: que el arbol se dibuje,
 * que el panel se abra y se cierre con Escape, que el panel cerrado no sea
 * alcanzable con Tab y que en movil no haya desbordamiento horizontal.
 *
 * Necesita un Chrome o Edge instalado. Arranca el servidor por su cuenta.
 *
 *   node tools/smoke.mjs [--shots <carpeta>]
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4399;
const BASE = `http://localhost:${PORT}`;

const shotsFlag = process.argv.indexOf("--shots");
const SHOT_DIR = shotsFlag !== -1 ? process.argv[shotsFlag + 1] : path.join(ROOT, ".smoke");

const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium"
];

function findBrowser() {
  const found = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`No se encontro ningun navegador. Rutas probadas:\n  ${CHROME_CANDIDATES.join("\n  ")}`);
  }
  return found;
}

let failures = 0;
function check(label, actual, expected) {
  const ok = typeof expected === "function" ? expected(actual) : actual === expected;
  if (!ok) {
    failures += 1;
  }
  console.log(`  ${ok ? "ok  " : "FALLO"} ${label}: ${actual}`);
}

async function withPage(browser, url, viewport = { width: 1280, height: 900 }) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  let requests = 0;
  page.on("console", (msg) => msg.type() === "error" && errors.push(`console: ${msg.text()}`));
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("requestfailed", (req) => errors.push(`requestfailed: ${req.url()}`));
  page.on("response", (res) => {
    requests += 1;
    if (res.status() >= 400) {
      errors.push(`HTTP ${res.status()} ${res.url()}`);
    }
  });
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);
  return { page, errors, requests: () => requests };
}

/**
 * Corre dentro del navegador. Compone los fondos translucidos de toda la
 * cadena de ancestros antes de calcular el ratio, que es lo que hace la
 * diferencia entre medir el color declarado y el que se ve de verdad.
 */
function measureContrast() {
  const parse = (color) => {
    const parts = color.match(/[\d.]+/g).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] === undefined ? 1 : parts[3] };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1
  });
  const luminance = (color) => {
    const channel = (value) => {
      const v = value / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  };
  const ratio = (a, b) => {
    const l1 = luminance(a);
    const l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const effectiveBackground = (element) => {
    const stack = [];
    let node = element;
    while (node) {
      const background = parse(getComputedStyle(node).backgroundColor);
      if (background.a > 0) {
        stack.push(background);
      }
      node = node.parentElement;
    }
    stack.push({ r: 255, g: 255, b: 255, a: 1 });
    let composed = stack[stack.length - 1];
    for (let i = stack.length - 2; i >= 0; i -= 1) {
      composed = over(stack[i], composed);
    }
    return composed;
  };

  const targets = [
    [".eyebrow", "eyebrow"],
    ["th", "cabecera de tabla"],
    [".lead", "lead"],
    [".description", "descripcion"],
    ["td", "celda"],
    [".site-nav__link", "enlace de navegacion"]
  ];

  return targets
    .map(([selector, label]) => {
      const element = document.querySelector(selector);
      if (!element) {
        return null;
      }
      const styles = getComputedStyle(element);
      const size = parseFloat(styles.fontSize);
      const isLarge = size >= 24 || (size >= 18.66 && parseInt(styles.fontWeight, 10) >= 700);
      return {
        label,
        ratio: Number(ratio(parse(styles.color), effectiveBackground(element)).toFixed(2)),
        min: isLarge ? 3 : 4.5
      };
    })
    .filter(Boolean);
}

function reportErrors(errors) {
  if (!errors.length) {
    console.log("  ok   sin errores de consola ni peticiones fallidas");
    return;
  }
  failures += 1;
  console.log(`  FALLO ${errors.length} errores:`);
  errors.slice(0, 8).forEach((error) => console.log(`         - ${error}`));
}

async function main() {
  await mkdir(SHOT_DIR, { recursive: true });
  const server = spawn(process.execPath, [path.join(ROOT, "tools", "serve.mjs"), String(PORT)], {
    stdio: "ignore"
  });
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const browser = await chromium.launch({ executablePath: findBrowser(), headless: true });
  try {
    console.log("\n== Listado ==");
    {
      const { page, errors } = await withPage(browser, "/index.html");
      check("titulo", await page.title(), (value) => value.includes("Martín"));
      check("filas", await page.locator("#records-body tr").count(), 6);
      check("enlaces por fila", await page.locator("#records-body tr:first-child a").count(), 1);
      reportErrors(errors);
      await page.screenshot({ path: path.join(SHOT_DIR, "listado.png") });
      await page.close();
    }

    console.log("\n== Arbol (vista predeterminada) ==");
    let treeRequests = 0;
    {
      const { page, errors, requests } = await withPage(browser, "/arbol.html");
      check("tarjetas dibujadas", await page.locator(".tree-node-card").count(), (n) => n > 0);
      check("mensaje de carga oculto", await page.locator("#tree-loading").isHidden(), true);
      check(
        "panel cerrado fuera del orden de tabulacion",
        await page.locator("#tree-panel").evaluate((el) => el.hasAttribute("inert")),
        true
      );

      await page.locator(".tree-node-card").first().click();
      await page.waitForTimeout(700);
      check("panel visible tras pulsar una tarjeta", await page.locator("#tree-panel").isVisible(), true);
      check(
        "referencia del panel enfocable",
        await page.evaluate(() => {
          const ref = document.querySelector(".tree-panel__ref");
          if (!ref) return "sin referencias";
          ref.focus();
          return document.activeElement === ref;
        }),
        (value) => value === true || value === "sin referencias"
      );

      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      check("Escape cierra el panel", await page.locator("#tree-panel").isHidden(), true);

      treeRequests = requests();
      reportErrors(errors);
      await page.screenshot({ path: path.join(SHOT_DIR, "arbol.png") });
      await page.close();
    }
    console.log(`  info peticiones para dibujar el arbol: ${treeRequests}`);

    console.log("\n== Vistas familiares ==");
    {
      const counts = {};
      for (const key of ["martin", "deantonio", "teresa-castano-pineda"]) {
        const { page, errors } = await withPage(browser, `/arbol.html?tree=${key}`);
        counts[key] = await page.locator(".tree-node-card").count();
        reportErrors(errors);
        await page.close();
      }
      console.log(`  info ${JSON.stringify(counts)}`);
      check("las vistas no coinciden", new Set(Object.values(counts)).size, (n) => n > 1);
    }

    console.log("\n== Ficha personal ==");
    {
      const { page, errors } = await withPage(browser, "/persona.html?id=isabel-minguez-gonzalez");
      check("nombre", await page.locator("#person-name").innerText(), "Isabel Mínguez González");
      check("datos sin valor", await page.locator("#person-facts dd:empty").count(), 0);
      check("imagenes de galeria", await page.locator(".gallery-card").count(), (n) => n > 0);
      check("imagen principal visible", await page.locator("#person-figure").isVisible(), true);
      reportErrors(errors);
      await page.screenshot({ path: path.join(SHOT_DIR, "ficha.png") });
      await page.close();
    }

    console.log("\n== Ruta de datos externa rechazada ==");
    {
      const { page } = await withPage(browser, "/persona.html?data=https://example.com/x.json");
      check("no se renderiza contenido externo", await page.locator("#person-name").innerText(), (value) =>
        value.startsWith("No se pudo")
      );
      await page.close();
    }

    console.log("\n== El tema de APP_CONFIG manda ==");
    {
      // Con el sistema en oscuro, el tema configurado debe seguir ganando:
      // prefers-color-scheme solo decide si la configuracion dice "auto".
      const source = await readFile(path.join(ROOT, "js/config/app-config.js"), "utf8");
      const configured = (source.match(/theme:\s*"([^"]+)"/) || [])[1] || "";
      const expected = configured === "auto" ? "dark" : configured;

      const page = await browser.newPage({ colorScheme: "dark" });
      await page.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded" });
      const applied = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
      check(`APP_CONFIG.theme = "${configured}" con el sistema en oscuro`, applied, expected);
      await page.close();
    }

    console.log("\n== Contraste WCAG AA en los tres temas ==");
    {
      const { page } = await withPage(browser, "/index.html");
      for (const theme of ["light-celestial", "dawn-amber", "dark"]) {
        await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
        await page.waitForTimeout(200);
        const rows = await page.evaluate(measureContrast);
        const worst = rows.reduce((acc, row) => (row.ratio / row.min < acc.ratio / acc.min ? row : acc));
        check(`${theme} (peor: ${worst.label})`, `${worst.ratio}:1 sobre ${worst.min}`, () =>
          rows.every((row) => row.ratio >= row.min)
        );
      }
      await page.close();
    }

    console.log("\n== Movil 375x667 ==");
    for (const [name, url] of [
      ["listado", "/index.html"],
      ["arbol", "/arbol.html"],
      ["ficha", "/persona.html?id=isabel-minguez-gonzalez"]
    ]) {
      const { page } = await withPage(browser, url, { width: 375, height: 667 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      check(`${name}: desbordamiento horizontal`, overflow, (value) => value <= 1);
      await page.screenshot({ path: path.join(SHOT_DIR, `movil-${name}.png`) });
      await page.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }

  console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nTodas las comprobaciones correctas");
  process.exitCode = failures ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
