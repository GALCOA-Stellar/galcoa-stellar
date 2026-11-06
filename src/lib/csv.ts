/** Convierte una planilla CSV (primera fila = nombres de campo) en la lista de documentos que usa la herramienta. */
const NUMERICOS = new Set(["cantidadPedida", "cantidadRecibida"]);

function filas(texto: string, sep: string): string[][] {
  const out: string[][] = [];
  let fila: string[] = [], campo = "", comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some((x) => x.trim() !== "")) out.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo);
  if (fila.some((x) => x.trim() !== "")) out.push(fila);
  return out;
}

export function csvADocumentos(texto: string): Record<string, unknown>[] {
  const limpio = texto.replace(/^﻿/, "");
  const primera = limpio.split(/\r?\n/, 1)[0] ?? "";
  const sep = primera.includes(";") && !primera.includes(",") ? ";" : primera.includes("\t") && !primera.includes(",") ? "\t" : ",";
  const f = filas(limpio, sep);
  if (f.length < 2) throw new Error("La planilla necesita una fila de títulos y al menos un remito");
  const cab = f[0].map((x) => x.trim());
  if (new Set(cab).size !== cab.length || cab.some((x) => !x)) throw new Error("Los títulos de columna están repetidos o vacíos");
  return f.slice(1).map((r) => {
    const o: Record<string, unknown> = {};
    cab.forEach((k, i) => {
      const v = (r[i] ?? "").trim();
      if (v === "") return; // celda vacía = dato faltante: las reglas lo marcan
      o[k] = NUMERICOS.has(k) && /^-?\d+([.,]\d+)?$/.test(v) ? Number(v.replace(",", ".")) : v;
    });
    return o;
  });
}
