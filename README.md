# Memorial Familia Martín - Tapias

Web estática con un listado memorial, fichas personales y un árbol genealógico
interactivo. JavaScript nativo con módulos ES, sin framework ni bundler.

## Puesta en marcha

Las páginas cargan sus datos con `fetch`, así que hay que servirlas por HTTP
(no vale abrir el fichero directamente):

```bash
npm install
npm run serve      # http://localhost:4321
```

`npx serve` también funciona, pero redirige quitando la extensión `.html` y en
esa redirección pierde la query string, con lo que `?id=` y `?tree=` no llegan.
Por eso el repositorio trae su propio servidor en `tools/serve.mjs`.

## Comprobaciones

```bash
npm run check      # lint + bundle + pruebas + validación de datos
npm run smoke      # prueba en un Chrome real: las 3 páginas, teclado y móvil
```

`npm run smoke` necesita un Chrome o Edge instalado; usa el del sistema y no
descarga ningún navegador.

## Estructura

```
index.html    → js/app.js       listado memorial
persona.html  → js/detail.js    ficha individual
arbol.html    → js/arbol.js     árbol genealógico

js/core/      utilidades compartidas (html, text, dates, url, net, i18n, theme)
js/listing/   tabla del listado (columns, sort, config, data, render)
js/detail/    ficha personal (data, render)
js/tree/      árbol (data, model, scope, panel, format, config)
js/config/    app-config.js: rutas, plantillas y parámetros del árbol

css/tokens.css  sistema de tokens y los tres temas
css/styles.css  estilos comunes
css/arbol.css   estilos del árbol

vendor/       d3 y family-chart, servidos desde el propio sitio
tools/        scripts de mantenimiento (ver más abajo)
```

## Datos

Hay una sola fuente de verdad para cada cosa:

| Fichero | Qué contiene |
|---|---|
| `data/personas/<id>.json` | Una ficha por persona. Todas viven aquí. |
| `data/personas-index.json` | Mapa `id → ruta` de las 161 fichas. |
| `data/unions.json` | Las 59 uniones familiares: parejas e hijos. |
| `data/tree-bundle.json` | Generado. Uniones + datos de tarjeta, en un solo fichero. |
| `data/trees/index.json` | Las vistas familiares (ver abajo). |
| `data/lista.json` | Qué personas y columnas muestra el listado. |
| `data/ui-text.es.json` | Todos los textos de interfaz. |

### Esquema de una ficha

```json
{
  "id": "isabel-minguez-gonzalez",
  "name": "Isabel Mínguez González",
  "gender": "female",
  "born": "1921-08-07",
  "died": "2009-09-30",
  "summary": "…",
  "heroImage": { "src": "…-card.jpg", "thumb": "…", "full": "…", "alt": "…" },
  "gallery": [],
  "facts": [{ "label": "Nacimiento", "value": "07/08/1921" }]
}
```

`born` y `died` van en ISO y admiten precisión parcial (`1890` vale). Las
etiquetas de `facts` salen de un vocabulario cerrado que valida
`tools/validate-data.mjs`. Los identificadores son ASCII (`^[a-z0-9-]+$`)
porque viajan en la URL y en selectores CSS.

### Vistas familiares

`arbol.html?tree=<clave>` no carga un árbol distinto: recorta el mismo grafo
alrededor de la persona raíz que declara `data/trees/index.json`. Cada vista
son tres campos:

```json
{ "key": "martin", "title": "Familia Martín", "rootPersonId": "castor-martin-bravo" }
```

El recorte (`js/tree/scope.js`) incluye a los ascendientes de esa persona,
todos sus descendientes, las parejas de esa sangre y las ramas de sus hermanos.

### Imágenes

Los originales a resolución completa se conservan en `images/originals/` como
archivo familiar: **no se sirven ni se enlazan**. Lo que consume la web son los
derivados de `images/personas/<slug>/`, en tres tamaños (`thumb` 96 px para los
avatares del árbol, `card` 640 px para la galería, `full` 1600 px para la vista
ampliada) y dos formatos (WebP con respaldo JPEG).

## Alta de una persona

1. Crear `data/personas/<id>.json` siguiendo el esquema de arriba.
2. Añadir la entrada `id → ruta` en `data/personas-index.json`.
3. Referenciar el `id` en las uniones de `data/unions.json`.
4. Si tiene fotos, dejarlas en `images/personas/<id>/` y ejecutar
   `npm run images` para generar los derivados.
5. `npm run build` para regenerar el bundle y `npm run check` para validar.

## Herramientas

| Comando | Qué hace |
|---|---|
| `npm run serve` | Servidor estático de desarrollo. |
| `npm run build` | Regenera `data/tree-bundle.json`. Obligatorio tras tocar fichas o uniones. |
| `npm run validate` | Comprueba índices, uniones, identificadores, fechas e imágenes. |
| `npm run images` | Deduplica y genera los derivados de `images/personas/`. |
| `npm run sitemap` | Regenera `sitemap.xml` y `robots.txt`. |
| `npm run smoke` | Prueba de humo en navegador. |
| `npm run check` | Todo lo que ejecuta CI. |

## Temas

Tres temas: `dark`, `light-celestial` y `dawn-amber`. El tema se resuelve en
`js/theme-boot.js`, un script síncrono en el `<head>`, en este orden: lo que el
visitante haya elegido (`localStorage`), luego `prefers-color-scheme`, y si no
el valor de `APP_CONFIG.theme`. Tiene que ser síncrono: desde un módulo ES el
navegador ya habría pintado con el tema anterior y se vería un parpadeo.

Al añadir un tema hay que tocar tres sitios: `css/tokens.css`,
`js/theme-boot.js` y `js/core/theme.js`.
