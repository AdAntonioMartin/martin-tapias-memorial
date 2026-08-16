# Pasos manuales pendientes

La separación está hecha y verificada en local para los **tres** repositorios.
Lo que queda requiere tu cuenta de GitHub, así que no puedo hacerlo desde aquí.
Nada de esto afecta todavía al sitio en vivo: sigue publicado lo de antes.

El orden importa.

## 1. Publicar el motor

La etiqueta y el remote ya están puestos en local. Falta crear el repositorio
`family-tree-engine` en GitHub y subirlo:

```bash
cd ../family-tree-engine
git push -u origin main --follow-tags     # sube main y la etiqueta v0.1.0
```

Si lo creas privado, los repos de familia necesitarán un token para instalarlo;
público es más simple.

## 2. Regenerar los lockfiles

Los dos repos de familia ya apuntan a `github:AdAntonioMartin/family-tree-engine#v0.1.0`,
pero sus `package-lock.json` se generaron con la ruta local. **`npm ci` fallará
en CI hasta que se regeneren**, y solo se puede hacer una vez el motor esté en
GitHub:

```bash
cd ../martin-tapias-memorial && npm install && npm run check
cd ../minguez_deantonio     && npm install && npm run check
```

Luego commitea los `package-lock.json` resultantes en cada uno.

## 3. Cambiar el origen de GitHub Pages en los dos sitios

**Ajustes → Pages → Source: GitHub Actions**, en `martin-tapias-memorial` y en
`minguez_deantonio`.

Es imprescindible y hay que hacerlo **antes** del primer push a `main`. Con el
origen anterior ("Deploy from a branch") se publicaría la rama tal cual, que ya
no tiene `index.html`, y el sitio daría 404.

## 4. Comprobar el primer despliegue

En la pestaña Actions deben salir en verde *CI* y *Desplegar a GitHub Pages*.
Luego, en cada sitio publicado:

- el listado carga y tiene filas
- el árbol se dibuja
- una ficha con fotos se ve bien
- `images/originals/` ya **no** está publicado

---

## Estado actual

| Repositorio | Qué es | Verificado |
|---|---|---|
| `family-tree-engine` | El motor. 62 ficheros, sin datos | 21 pruebas en verde |
| `martin-tapias-memorial` | 161 personas, 59 uniones, 3 vistas | check y smoke en verde |
| `minguez_deantonio` | 14 personas, 5 uniones, 1 vista | check y smoke en verde |

## Aviso sobre los datos duplicados

Las 14 personas de `minguez_deantonio` **también están** en
`martin-tapias-memorial`, donde esa rama es además la vista `?tree=deantonio`.

Son copias independientes. Si corriges una fecha o añades una foto de alguien
que aparece en los dos sitios, **hay que hacerlo en ambos** o quedarán
divergentes. No hay ningún mecanismo que los sincronice.

Si en algún momento molesta, la salida limpia es quedarse solo con
`martin-tapias-memorial` y usar la vista, que muestra exactamente esa rama.

## Cómo se propagan las mejoras del motor

1. Cambias algo en `family-tree-engine`, `npm run check`, y publicas etiqueta
   nueva (`npm version minor && git push --follow-tags`).
2. Dependabot abre una PR en cada repo de familia subiendo la versión.
3. El CI de ese repo construye el sitio y valida sus datos con la versión nueva.
4. Si está en verde, mezclas y se despliega solo.

Ninguna familia se actualiza sin pasar por su propio CI, así que un cambio que
rompa unos datos concretos se detecta antes de publicarse.

## Crear una familia más adelante

```bash
npx family-tree-init familia-nueva --name "Familia Nueva" --url https://adantoniomartin.github.io/familia-nueva
cd familia-nueva && npm install && npm run serve
```

Deja un sitio que ya construye y valida, con dos fichas de ejemplo que se
sustituyen por datos reales.
