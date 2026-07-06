# minguez_deantonio

Web estatica para listado memorial, fichas personales y arbol genealogico.

## Estructura

- `index.html`: portada con listado.
- `persona.html`: ficha personal.
- `arbol.html`: visualizacion genealogica con `family-chart`.
- `data/lista.json`: configuracion de personas visibles, columnas y orden del listado.
- `data/personas-index.json`: fuente unica de mapeo `id -> ruta JSON`.
- `data/arbol.json`: relaciones familiares (`unions`).
- `data/trees/index.json`: registro de arboles separados por familia.
- `data/trees/<clave>/arbol.json`: relaciones (`unions`) por familia.
- `data/trees/<clave>/personas-index.json`: indice de personas por familia.
- `data/ui-text.es.json`: textos de interfaz (titulos, labels, mensajes, botones).
- `data/personas/<slug>.json`: fichas personales.
- `images/trees/<clave>/personas/<slug>/`: imagenes separadas por familia.
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
- `APP_CONFIG.data.treeRegistry`
- `APP_CONFIG.data.uiText`
- `APP_CONFIG.templates.detail`

El listado y el detalle leen estas rutas por defecto. `index.html` ya no replica rutas en atributos `data-*`.

## Listado personalizado

La portada `index.html` muestra solo las rutas incluidas en `data/lista.json`, dentro de `personas`.
Para cambiar la seleccion, edita ese array con rutas a fichas de `data/personas/<slug>.json`.
Si se elimina `personas` o se deja vacio, el listado vuelve a cargar todas las personas desde `data/personas-index.json`.

## Alta de una persona

1. Crear `data/personas/<slug>.json`.
2. Agregar su ruta en `data/personas-index.json` bajo `byId`.
3. (Opcional) referenciar su `id` en `data/arbol.json` para incluirla en el arbol.

## Multiples arboles por familia

`arbol.html` admite `?tree=<clave>` y carga fuentes desde `data/trees/index.json`.

Ejemplos:

- `arbol.html?tree=global`
- `arbol.html?tree=martin`
- `arbol.html?tree=deantonio`

## Nota de ejecucion

La carga se hace con `fetch`. Sirve el proyecto con un servidor estatico (no abrir como `file://`).
