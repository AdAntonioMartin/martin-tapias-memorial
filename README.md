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

## Configuración del sitio

Todo lo que distingue a este memorial de otro —el nombre, el dominio, el idioma,
el tema— vive en `site.config.json`. El resto del código no sabe de qué familia
es, que es lo que permitirá sacarlo a una librería compartida.

De ahí se **generan** cuatro cosas, y por eso no se editan a mano:

| Generado | Desde |
|---|---|
| `index.html`, `arbol.html`, `persona.html` | `templates/` + `site.config.json` |
| `js/config/app-config.js` | `defaults/app-config.json` + `site.config.json` |
| `data/ui-text.es.json` | `defaults/ui-text.es.json` + `site.config.json` |

`npm run build` los regenera; `npm run build:check` (que ejecuta CI) falla si
alguno se ha editado a mano o se ha quedado atrás. Para cambiar un texto de
interfaz sin tocar el motor, se crea `site-text.es.json` en la raíz con solo las
claves a sustituir: se fusiona en profundidad sobre las del motor.

## Estructura

```
site.config.json  identidad del sitio: nombre, dominio, idioma, tema
templates/        plantillas de las tres páginas, con {{marcadores}}
defaults/         valores y textos del motor, comunes a cualquier memorial

index.html    → js/app.js       listado memorial      (generado)
persona.html  → js/detail.js    ficha individual      (generado)
arbol.html    → js/arbol.js     árbol genealógico     (generado)

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

Para añadir una foto a una persona, lo normal es `npm run add-photo`: genera
los derivados y además escribe el bloque `heroImage`/`gallery` en su ficha, en
vez de tener que copiar a mano una docena de rutas y medir cada imagen.

```bash
npm run add-photo -- <id> <ruta-a-la-foto> [--hero] [--alt "…"] [--caption "…"]
```

Sin `--hero` la foto se añade a `gallery`. Es idempotente: si los derivados ya
están en disco no se recodifican (`--force` lo fuerza), y si la ficha ya
referencia esa imagen no se duplica — repetir el comando es seguro. `--dry-run`
enseña el JSON que añadiría sin escribir nada.

Para soltar muchas fotos nuevas de golpe sigue estando `npm run images`: recorre
`images/personas/`, deduplica por hash y genera los derivados, pero no toca
ningún JSON — esa parte hay que hacerla luego a mano o foto a foto con
`add-photo`.

## Alta de una persona

1. Crear `data/personas/<id>.json` siguiendo el esquema de arriba.
2. Añadir la entrada `id → ruta` en `data/personas-index.json`.
3. Referenciar el `id` en las uniones de `data/unions.json`.
4. Añadir sus fotos con `npm run add-photo -- <id> <foto> [--hero]`.
5. `npm run build` para regenerar el bundle y `npm run check` para validar.

## Herramientas

| Comando | Qué hace |
|---|---|
| `npm run serve` | Servidor estático de desarrollo. |
| `npm run build` | Regenera los ficheros generados y `data/tree-bundle.json`. Obligatorio tras tocar fichas, uniones o `site.config.json`. |
| `npm run build:check` | Falla si algún fichero generado se editó a mano o está desactualizado. |
| `npm run validate` | Comprueba índices, uniones, identificadores, fechas, imágenes y que el bundle esté al día. |
| `npm run add-photo -- <id> <foto>` | Genera los derivados de una foto y la escribe en la ficha de la persona. |
| `npm run images` | Deduplica y genera los derivados de todas las fotos sueltas en `images/personas/`. |
| `npm run sitemap` | Regenera `sitemap.xml` y `robots.txt`. |
| `npm run smoke` | Prueba de humo en navegador. |
| `npm run check` | Todo lo que ejecuta CI. |

## Temas

Para cambiar el tema del sitio se edita una sola línea, en `site.config.json`
(no en `js/config/app-config.js`, que se genera a partir de él):

```json
"theme": "dawn-amber"
```

Valores admitidos: `dark`, `light-celestial`, `dawn-amber`, `auto`.

`auto` sigue la preferencia del sistema. Cualquier otro valor manda sobre esa
preferencia: si el sitio está configurado en claro, se ve claro aunque el
visitante tenga el sistema operativo en oscuro. Lo único que gana al valor
configurado es una elección explícita del propio visitante en la página, que se
guarda en `localStorage` (`setTheme()` en `js/core/theme.js`, y
`clearThemeChoice()` para volver a lo que diga la configuración).

El orden completo es: elección del visitante → `APP_CONFIG.theme` →
`prefers-color-scheme` (solo si vale `auto` o si el valor configurado no es
válido).

### Por qué la configuración es un script clásico

`js/config/app-config.js` no es un módulo ES: asigna `window.APP_CONFIG` y se
carga de forma síncrona en el `<head>`, antes que `js/theme-boot.js`. Tiene que
ser así porque `type="module"` es diferido por definición: si el tema se
aplicara desde un módulo, el navegador ya habría pintado con el tema anterior y
se vería un parpadeo en cada carga. Los módulos leen la configuración a través
de `js/config/index.js`, que solo la reexpone.

El generador (`tools/build-site.mjs`) mantiene esa forma: escribe un script
clásico, no un módulo. Si algún día se cambia, vuelve el parpadeo.

Si se añade un tema hay que tocar tres sitios: `css/tokens.css`,
`js/theme-boot.js` y `js/core/theme.js`.
