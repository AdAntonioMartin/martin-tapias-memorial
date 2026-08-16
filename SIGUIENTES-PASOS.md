# Pasos manuales pendientes

La separación está hecha y verificada en local, pero hay cuatro cosas que no se
pueden hacer desde aquí porque requieren tu cuenta de GitHub. **Hasta que las
hagas, no publiques**: el sitio en vivo sigue funcionando con lo que ya está
desplegado, y nada de lo hecho en local lo afecta todavía.

El orden importa.

## 1. Publicar el motor en GitHub

```bash
cd ../family-tree-engine
git tag v0.1.0
```

Crea el repositorio `family-tree-engine` en GitHub (público o privado; si es
privado, los repos de familia necesitarán un token para instalarlo) y luego:

```bash
git remote add origin https://github.com/AdAntonioMartin/family-tree-engine.git
git push -u origin main --follow-tags
```

## 2. Apuntar este repositorio a esa etiqueta

Ahora mismo la dependencia es local, para haber podido verificarlo todo sin
GitHub:

```json
"family-tree-engine": "file:../family-tree-engine"
```

Una ruta `file:` **no funciona en CI**: `npm ci` fallará porque esa carpeta no
existe en el runner. Cámbiala:

```bash
npm pkg set dependencies.family-tree-engine="github:AdAntonioMartin/family-tree-engine#v0.1.0"
npm install
npm run check    # debe seguir dando 0 errores
git add package.json package-lock.json
git commit -m "Apuntar el motor a la etiqueta publicada"
```

## 3. Cambiar el origen de GitHub Pages

**Ajustes → Pages → Source: GitHub Actions.**

Es imprescindible. Con el origen anterior ("Deploy from a branch") se publicaría
la rama tal cual, que ya no tiene `index.html`, y el sitio daría 404. El
workflow incluye `actions/configure-pages` con `enablement: true` para
intentarlo automáticamente, pero conviene comprobarlo a mano.

Haz este paso **antes** del primer push a `main`.

## 4. Comprobar el primer despliegue

Tras el push, en la pestaña Actions deben salir en verde *CI* y *Desplegar a
GitHub Pages*. Luego revisa en el sitio publicado:

- el listado carga y tiene 7 filas
- `arbol.html?tree=martin` dibuja el árbol
- una ficha con fotos se ve bien
- `images/originals/` ya **no** está publicado (ahorra ~70 MB)

---

## Después: la segunda familia

`minguez_deantonio` es candidato natural. Dos caminos:

**Empezar limpio** y traer los datos a mano:

```bash
cd ..
npx family-tree-init minguez-deantonio --name "Familia Mínguez - De Antonio" --url https://adantoniomartin.github.io/minguez_deantonio
```

**Convertir el repo existente**: borrar de él `js/`, `css/` y los HTML, añadir
`site.config.json` y el `package.json` con la dependencia, y adaptar sus datos
al esquema (`data/personas/`, `data/unions.json`, `data/trees/index.json`).
Requiere revisar si su formato de datos coincide con el de aquí.

Cuando quieras, lo miro y te digo cuál sale más a cuenta.

## Cómo se propagan las mejoras del motor a partir de ahora

1. Cambias algo en `family-tree-engine`, `npm run check`, y publicas etiqueta
   nueva (`npm version minor && git push --follow-tags`).
2. Dependabot abre una PR en cada repo de familia subiendo la versión.
3. El CI de ese repo construye el sitio y valida sus datos con la versión nueva.
4. Si está en verde, mezclas y se despliega solo.

Ninguna familia se actualiza sin pasar por su propio CI, así que un cambio que
rompa unos datos concretos se detecta antes de publicarse.
