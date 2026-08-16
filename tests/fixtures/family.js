/*
 * Grafo familiar sintetico para las pruebas del motor.
 *
 * Antes estas pruebas leian data/, es decir los datos reales de una familia
 * concreta. Eso las ataba a este sitio: al mover el motor a su propio
 * repositorio se habrian quedado sin ficheros, y cualquier cambio en las fichas
 * podia romperlas sin que el codigo tuviera nada malo.
 *
 * La fixture es deliberadamente pequena pero cubre lo que el modelo necesita
 * distinguir: dos ramas sin contacto entre si (para que los recortes salgan de
 * tamanos distintos), tres generaciones en una de ellas, y ambos generos mas
 * un caso sin determinar.
 *
 *   rama 1:  raiz-uno + raiz-uno-pareja
 *              -> hijo-uno + hijo-uno-pareja
 *                   -> nieta-uno
 *   rama 2:  raiz-dos + raiz-dos-pareja
 *              -> hija-dos
 */

export const people = {
  "raiz-uno": { name: "Raiz Uno", gender: "male", born: "1900", died: "1970" },
  "raiz-uno-pareja": { name: "Raiz Uno Pareja", gender: "female", born: "1902", died: "1975" },
  "hijo-uno": { name: "Hijo Uno", gender: "male", born: "1930", died: "2000" },
  "hijo-uno-pareja": { name: "Hijo Uno Pareja", gender: "female", born: "1932", died: "" },
  "nieta-uno": { name: "Nieta Uno", gender: "female", born: "1960", died: "" },
  "raiz-dos": { name: "Raiz Dos", gender: "male", born: "1905", died: "1980" },
  "raiz-dos-pareja": { name: "Raiz Dos Pareja", gender: "unknown", born: "", died: "" },
  "hija-dos": { name: "Hija Dos", gender: "female", born: "1935", died: "" }
};

export const unions = [
  {
    id: "u-raiz-uno",
    partners: ["raiz-uno", "raiz-uno-pareja"],
    children: ["hijo-uno"],
    type: "married"
  },
  {
    id: "u-hijo-uno",
    partners: ["hijo-uno", "hijo-uno-pareja"],
    children: ["nieta-uno"],
    type: "married"
  },
  {
    id: "u-raiz-dos",
    partners: ["raiz-dos", "raiz-dos-pareja"],
    children: ["hija-dos"],
    type: "married"
  }
];

/** Dos vistas sobre el mismo grafo, de tamanos distintos a proposito. */
export const registry = {
  defaultTree: "rama-uno",
  trees: [
    { key: "rama-uno", title: "Rama Uno", rootPersonId: "raiz-uno" },
    { key: "rama-dos", title: "Rama Dos", rootPersonId: "raiz-dos" }
  ]
};

export const bundle = { unions, people };
