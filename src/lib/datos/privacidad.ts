import { createHash } from "node:crypto";
import { borrar, guardar, listar, nuevoId } from "./almacen";
import type { Confirmacion } from "./confirmacion";
import type { Operacion } from "./historial";
import { borrarRondaVencida, type Ronda } from "./ronda";

/**
 * Datos personales (Ley 25.326): acceso (descarga), supresión (borrado) y plazo de conservación.
 * Qué se guarda en esta instalación: el archivo de cada lote (con los identificadores internos de quien cargó y confirmó)
 * y las respuestas del comercio (con el comentario libre que escriba). A Stellar solo va una huella, que no permite
 * reconstruir esos datos: no se puede ni hace falta borrar nada de la red.
 */
export const DIAS_CONSERVACION = () => Math.max(1, Number(process.env.DIAS_CONSERVACION) || 365);
const DIA = 86_400_000;
/** Las confirmaciones se conservan 30 días después de vencer el enlace. */
const GRACIA_CONFIRMACIONES_DIAS = 30;

/** Borra lo que ya cumplió su plazo. Devuelve cuánto borró. Se llama de forma oportunista (no hace falta un cron). */
export async function limpiarVencidos(ahora = Date.now()): Promise<{ operaciones: number; confirmaciones: number; rondas: number }> {
  let operaciones = 0, confirmaciones = 0, rondas = 0;
  for (const o of await listar<Operacion>("operaciones", 5000)) {
    if (ahora - Date.parse(o.fecha) > DIAS_CONSERVACION() * DIA && (await borrar("operaciones", o.id))) operaciones++;
  }
  for (const c of await listar<Confirmacion>("confirmaciones", 5000)) {
    if (ahora > Date.parse(c.vence) + GRACIA_CONFIRMACIONES_DIAS * DIA && (await borrar("confirmaciones", c.id))) confirmaciones++;
  }
  for (const r of await listar<Ronda>("rondas", 5000)) {
    if (ahora > Date.parse(r.vence) + GRACIA_CONFIRMACIONES_DIAS * DIA) { await borrarRondaVencida(r); rondas++; }
  }
  return { operaciones, confirmaciones, rondas };
}

let ultimaLimpieza = 0;
/** Como mucho una vez por hora por proceso. */
export async function limpiarSiToca(ahora = Date.now()): Promise<void> {
  if (ahora - ultimaLimpieza < 3_600_000) return;
  ultimaLimpieza = ahora;
  try { await limpiarVencidos(ahora); } catch (e) { console.error("limpieza:", e instanceof Error ? e.message : e); }
}

/** Operaciones donde figura esta persona (por su identificador interno): firmó o cargó documentos. */
export async function operacionesDe(identidad: string): Promise<Operacion[]> {
  const todas = await listar<Operacion>("operaciones", 5000);
  return todas.filter((o) => (o.personas ?? []).includes(identidad) || ((o.archivo as { cargaron?: string[] } | null)?.cargaron ?? []).includes(identidad));
}

/** Borra las operaciones de una persona y deja constancia SIN datos personales (solo un hash de su identificador y la cantidad). */
export async function borrarDatosDe(identidad: string, ahora = Date.now()): Promise<number> {
  let n = 0;
  for (const o of await operacionesDe(identidad)) if (await borrar("operaciones", o.id)) n++;
  await guardar("borrados", nuevoId(), { fecha: new Date(ahora).toISOString(), identidadHash: createHash("sha256").update(identidad).digest("hex"), operacionesBorradas: n });
  return n;
}
