import { sha256 } from "../dominio/canonical";
import { evaluarFoto, leerMetadatos, type MetadatosFoto } from "../dominio/foto";
import { evaluarInformeFoto, evaluarInformeVoz, type InformePerito } from "../dominio/multimedia";
import type { Regla, Veredicto } from "../dominio/rules";
import { desafioDeVoz, evaluarVoz, type DesafioVoz } from "../dominio/voz";

/**
 * Evidencia multimedia: junta las reglas de foto y de voz en un veredicto. Mismo criterio que las entregas:
 * rojo si falla una regla crítica, amarillo si falla una advertencia, verde si todo pasa. La IA (perito) solo aporta indicios.
 * Un verde acá NO dice que la foto o la voz sean auténticas: dice que no se encontraron señales de lo contrario.
 */
export type ResultadoEvidencia = {
  tipo: "foto" | "voz";
  huella: string;
  bytes: number;
  veredicto: Veredicto;
  reglas: Regla[];
  metadatos?: MetadatosFoto;
  transcripcion?: string;
  aviso: string;
};

const AVISO = "Esto detecta señales de edición, repetición o falta de respaldo. No prueba que la evidencia sea auténtica: lo dudoso lo decide una persona.";

export const huellaDe = (bytes: Uint8Array): string => sha256(Buffer.from(bytes)).toString("hex");

export function veredictoDe(reglas: Regla[]): Veredicto {
  if (reglas.some((r) => !r.ok && r.gravedad === "critica")) return "rojo";
  return reglas.some((r) => !r.ok) ? "amarillo" : "verde";
}

/** Foto de evidencia: huella del original (ALC-ORI-01), metadatos y marcas de IA (ALC-FOT-01) e informe del perito (ALC-MED-01). */
export function analizarFoto(p: { bytes: Uint8Array; informe: InformePerito | null; fechaEntrega: string; fechaRegistro: string }): ResultadoEvidencia {
  const huella = huellaDe(p.bytes);
  const metadatos = leerMetadatos(p.bytes);
  const reglas: Regla[] = [
    { id: "ALC-ORI-01", atributo: "Original", ok: true, gravedad: "advertencia", detalle: `Huella SHA-256 del original: ${huella.slice(0, 16)}…` },
    ...evaluarFoto(metadatos, p.fechaEntrega, p.fechaRegistro),
    ...evaluarInformeFoto(p.informe),
  ];
  return { tipo: "foto", huella, bytes: p.bytes.length, veredicto: veredictoDe(reglas), reglas, metadatos, aviso: AVISO };
}

/** Audio de evidencia: frase al azar (ALC-VOZ-01), se entiende (02), voz sintética (03) y firma de cuenta autorizada (04). */
export function analizarVoz(p: {
  bytes: Uint8Array;
  informe: InformePerito | null;
  transcripcion: string;
  desafio: DesafioVoz;
  emitidoMs: number;
  recibidoMs: number;
  atribucion: { cuentaAutorizada: boolean; firmaValida: boolean };
}): ResultadoEvidencia {
  const huella = huellaDe(p.bytes);
  const reglas: Regla[] = [
    { id: "ALC-ORI-01", atributo: "Original", ok: true, gravedad: "advertencia", detalle: `Huella SHA-256 del original: ${huella.slice(0, 16)}…` },
    // Sin transcripción (perito caído) no se puede comprobar la frase: queda en rojo, nunca "ok por falta de datos".
    p.informe === null
      ? { id: "ALC-VOZ-01", atributo: "Original", ok: false, gravedad: "critica" as const, detalle: "No se pudo transcribir el audio, así que no se comprobó la frase del desafío: requiere revisión" }
      : evaluarVoz(p.transcripcion, p.desafio, p.emitidoMs, p.recibidoMs),
    ...evaluarInformeVoz(p.informe, p.atribucion),
  ];
  return { tipo: "voz", huella, bytes: p.bytes.length, veredicto: veredictoDe(reglas), reglas, transcripcion: p.transcripcion, aviso: AVISO };
}

export { desafioDeVoz };
