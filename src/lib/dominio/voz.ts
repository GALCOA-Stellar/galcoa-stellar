import type { Regla } from "./rules";

/**
 * ALC-VOZ-01: desafío de frase al azar para audios de evidencia.
 * La persona graba el audio diciendo una frase que el servidor le acaba de dar. Un audio grabado antes o reutilizado
 * no puede contener esa frase. Prueba que el audio es nuevo; NO prueba quién habla ni que la voz sea humana
 * (una voz clonada en vivo podría leerla). Lo dudoso lo decide una persona.
 */
export const REGLA_VOZ = "ALC-VOZ-01";
export const VENTANA_VOZ_MS = 5 * 60_000;

const PALABRAS = ["almendra", "bodega", "cartel", "delta", "espiga", "faro", "granja", "huerta", "isla", "jarra", "kiosco", "laguna", "molino", "naranja", "olivo", "puente", "queso", "roble", "sendero", "tambor", "umbral", "vereda", "yerba", "zorzal"];

export type DesafioVoz = { frase: string; palabras: string[]; numero: string };

/** Arma la frase a partir de bytes al azar (el servidor los saca de crypto.getRandomValues). */
export function desafioDeVoz(azar: Uint8Array): DesafioVoz {
  if (azar.length < 6) throw new Error("Hacen falta 6 bytes al azar");
  const palabras = [0, 1, 2].map((i) => PALABRAS[azar[i] % PALABRAS.length]);
  const numero = [3, 4, 5].map((i) => String(azar[i] % 10)).join("");
  return { frase: `${palabras.join(" ")} ${numero.split("").join(" ")}`, palabras, numero };
}

const limpiar = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const DIGITOS: Record<string, string> = { cero: "0", uno: "1", un: "1", dos: "2", tres: "3", cuatro: "4", cinco: "5", seis: "6", siete: "7", ocho: "8", nueve: "9" };

/** Revisa que la transcripción contenga las palabras y luego los dígitos del desafío, en ese orden, dentro de la ventana. */
export function evaluarVoz(transcripcion: string, d: DesafioVoz, emitidoMs: number, recibidoMs: number): Regla {
  const regla = (ok: boolean, detalle: string): Regla => ({ id: REGLA_VOZ, atributo: "Original", ok, gravedad: "critica", detalle });
  if (recibidoMs < emitidoMs || recibidoMs - emitidoMs > VENTANA_VOZ_MS) return regla(false, "El audio llegó fuera del tiempo del desafío: requiere revisión");
  const fichas = limpiar(transcripcion).split(" ").map((f) => DIGITOS[f] ?? f);
  let pos = 0;
  for (const p of d.palabras) { const i = fichas.indexOf(p, pos); if (i < 0) return regla(false, "El audio no dice la frase del desafío: requiere revisión"); pos = i + 1; }
  const digitos = fichas.slice(pos).join("").replace(/[^0-9]/g, "");
  if (!digitos.includes(d.numero)) return regla(false, "El audio no dice los números del desafío: requiere revisión");
  return regla(true, "El audio contiene la frase del desafío, dicha dentro del tiempo (prueba que es nuevo, no quién habla)");
}
