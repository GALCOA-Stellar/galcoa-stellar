// Congela las respuestas correctas de la evaluación de agentes: guarda su huella SHA-256.
// Si alguien cambia una etiqueta a escondidas, la prueba "etiquetas congeladas" falla.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const texto = readFileSync("evals/agentes/etiquetas.json", "utf8").replace(/\r\n/g, "\n");
const huella = createHash("sha256").update(texto).digest("hex");
writeFileSync("evals/agentes/etiquetas.lock", `${huella}\n`);
console.log("Etiquetas congeladas:", huella);
