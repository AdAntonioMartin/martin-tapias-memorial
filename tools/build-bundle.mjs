/**
 * Genera data/tree-bundle.json.
 *
 * Dibujar el arbol costaba unas 197 peticiones HTTP: el registro, las uniones,
 * el indice y una peticion por cada una de las 161 fichas. Contra el limite de
 * seis conexiones por servidor eso son ~27 rondas encadenadas antes del primer
 * pixel, y los 161 ficheros juntos pesan menos que el propio indice.
 *
 * El bundle lleva solo los campos que el arbol necesita para pintar una
 * tarjeta; la ficha completa se sigue pidiendo aparte al abrir una persona.
 *
 *   node tools/build-bundle.mjs
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = "data/tree-bundle.json";

const readJson = async (relPath) => JSON.parse(await readFile(path.join(ROOT, relPath), "utf8"));

async function main() {
  const { unions } = await readJson("data/unions.json");
  const { byId } = await readJson("data/personas-index.json");

  const people = {};
  for (const [id, relPath] of Object.entries(byId)) {
    const record = await readJson(relPath);
    const entry = {
      name: record.name,
      gender: record.gender,
      path: relPath
    };
    if (record.born) {
      entry.born = record.born;
    }
    if (record.died) {
      entry.died = record.died;
    }
    if (record.summary) {
      entry.summary = record.summary;
    }
    const thumb = record.heroImage && (record.heroImage.thumb || record.heroImage.src);
    if (thumb) {
      entry.thumb = thumb;
    }
    people[id] = entry;
  }

  const bundle = { unions, people };
  await writeFile(path.join(ROOT, OUT), `${JSON.stringify(bundle)}\n`, "utf8");

  const bytes = Buffer.byteLength(JSON.stringify(bundle));
  console.log(
    `${OUT}: ${Object.keys(people).length} personas, ${unions.length} uniones, ${(bytes / 1024).toFixed(1)} KB`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
