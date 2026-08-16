# Memorial Familia Martín - Tapias

Datos de este memorial: las personas, sus lazos y sus fotografías. El código de
la web vive en [family-tree-engine](https://github.com/AdAntonioMartin/family-tree-engine)
y llega como dependencia, de forma que una mejora del motor puede llegar aquí
sin copiar nada a mano.

## Puesta en marcha

```bash
npm install
npm run serve      # construye dist/ y lo sirve en http://localhost:4321
npm run check      # construye y valida los datos — pásalo antes de terminar
npm run smoke      # prueba en un Chrome real: las 3 páginas, teclado y móvil
```

`npm run build` produce `dist/`, que es lo que se publica: junta estos datos con
el código del motor. `dist/` no se versiona.

## Qué hay aquí

| Ruta | Qué es |
|---|---|
| `site.config.json` | Nombre, dominio, idioma y tema del sitio |
| `data/personas/<id>.json` | Una ficha por persona. Todas viven aquí |
| `data/personas-index.json` | Mapa `id → ruta` de las 161 fichas |
| `data/unions.json` | Las 59 uniones: parejas e hijos. Única fuente de parentesco |
| `data/trees/index.json` | Las vistas familiares (ver abajo) |
| `data/lista.json` | Qué personas y columnas muestra el listado |
| `images/personas/` | Fotos servidas, en tres tamaños y dos formatos |
| `images/originals/` | Archivo a resolución completa. **Nunca se publica** |

Los textos de interfaz salen del motor. Para cambiar alguno sin tocarlo, se crea
`site-text.es.json` en la raíz con solo las claves a sustituir.

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
etiquetas de `facts` salen de un vocabulario cerrado. Los identificadores son
ASCII (`^[a-z0-9-]+$`) porque viajan en la URL y en selectores CSS. Todo esto lo
comprueba `npm run validate`.

### Vistas familiares

`arbol.html?tree=<clave>` no carga un árbol distinto: recorta el mismo grafo
alrededor de la persona raíz que declara `data/trees/index.json`.

```json
{ "key": "martin", "title": "Familia Martín", "rootPersonId": "castor-martin-bravo" }
```

El recorte incluye a los ascendientes de esa persona, todos sus descendientes,
las parejas de esa sangre y las ramas de sus hermanos.

## Alta de una persona

1. Crear `data/personas/<id>.json` siguiendo el esquema de arriba.
2. Añadir la entrada `id → ruta` en `data/personas-index.json`.
3. Referenciar el `id` en las uniones de `data/unions.json`.
4. Añadir sus fotos con `npm run add-photo -- <id> <foto> [--hero]`.
5. `npm run check`.

## Fotografías

```bash
npm run add-photo -- <id> <ruta-a-la-foto> [--hero] [--alt "…"] [--caption "…"]
```

Genera los tres tamaños (`thumb` 96 px para el árbol, `card` 640 px para la
galería, `full` 1600 px) en WebP y JPEG, archiva el original en
`images/originals/` y escribe el bloque de imagen en la ficha. Sin `--hero` se
añade a la galería. Es idempotente: repetirlo no recodifica ni duplica nada.

Para soltar muchas fotos de golpe, `npm run images` hace la pasada masiva
deduplicando por hash, pero no toca los JSON.

## Tema

Una línea en `site.config.json`:

```json
"theme": "light-celestial"
```

Valores: `dark`, `light-celestial`, `dawn-amber`, `auto`. `auto` sigue la
preferencia del sistema; cualquier otro manda sobre ella. Lo único que gana es
una elección explícita del visitante, que se guarda en su navegador.

## Publicación

Cada push a `main` dispara el workflow que construye `dist/` y lo publica en
GitHub Pages. En **Ajustes → Pages**, el origen debe ser **GitHub Actions**.
