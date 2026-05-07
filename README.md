# minguez_deantonio

Web estatica para listado memorial, fichas personales y arbol genealogico.

## Estructura

- `index.html`: portada con listado.
- `persona.html`: ficha personal.
- `arbol.html`: visualizacion genealogica con `family-chart`.
- `data/lista.json`: configuracion de columnas y orden del listado.
- `data/personas-index.json`: fuente unica de mapeo `id -> ruta JSON`.
- `data/arbol.json`: relaciones familiares (`unions`).
- `data/ui-text.es.json`: textos de interfaz (titulos, labels, mensajes, botones).
- `data/personas/<slug>.json`: fichas personales.
- `js/config/app-config.js`: configuracion central de rutas/plantillas/tema.

## Arbol genealogico

La pagina `arbol.html` usa:

- `https://unpkg.com/d3@7`
- `https://unpkg.com/family-chart@0.9.0`

El pipeline en `js/tree/data.js` transforma `unions + fichas` al formato de `family-chart` (`id`, `data`, `rels`).

## Configuracion sin duplicados

Las rutas y plantillas comunes se definen en un unico sitio:

- `APP_CONFIG.data.listConfig`
- `APP_CONFIG.data.peopleIndex`
- `APP_CONFIG.data.treeConfig`
- `APP_CONFIG.data.uiText`
- `APP_CONFIG.templates.detail`

El listado y el detalle leen estas rutas por defecto. `index.html` ya no replica rutas en atributos `data-*`.

## Alta de una persona

1. Crear `data/personas/<slug>.json`.
2. Agregar su ruta en `data/personas-index.json` bajo `byId`.
3. (Opcional) referenciar su `id` en `data/arbol.json` para incluirla en el arbol.

## Nota de ejecucion

La carga se hace con `fetch`. Sirve el proyecto con un servidor estatico (no abrir como `file://`).
