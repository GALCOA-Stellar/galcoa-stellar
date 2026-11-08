import "server-only";
import { createHash } from "node:crypto";
import { canonical } from "../dominio/canonical";
import { guardar, leer, nuevoId } from "./almacen";
import { evaluar } from "../dominio/rules";
import { DATOS_PUBLICOS, emitirSello } from "./sello-comercio";
import { liberar, reclamar } from "./almacen";

/**
 * Confirmación del comercio por enlace o QR, sin crear cuenta (como en GALCOA+ original).
 * Qué prueba: que quien tenía el enlace dijo "lo recibí así" o "no coincide", en esa fecha y hora del servidor.
 * Qué NO prueba: quién es esa persona. Por eso el texto dice "declaró", nunca "certificó" ni "validó".
 * El enlace es secreto (128 bits al azar), de un solo uso y vence.
 */
export const VIGENCIA_ENLACE_MS = 7 * 24 * 60 * 60_000;

export type Estado = "pendiente" | "confirmada" | "no_coincide";
export type Confirmacion = {
  id: string; documento: Record<string, unknown>; huella: string; estado: Estado;
  creada: string; vence: string; respondida?: string; nota?: string;
};
export const huellaDe = (d: unknown) => createHash("sha256").update(canonical(d), "utf8").digest("hex");

/** Solo se muestra al comercio lo que le toca confirmar (nada interno de la distribuidora). `sello` solo existe si confirmó. */
export const vistaPublica = (c: Confirmacion) => ({
  estado: c.estado, vence: c.vence, respondida: c.respondida,
  ...(c.estado === "confirmada" ? { sello: emitirSello(c.id, c.documento) } : {}),
  documento: Object.fromEntries(DATOS_PUBLICOS.filter((k) => c.documento[k] !== undefined).map((k) => [k, c.documento[k]])),
  vencida: Date.now() > Date.parse(c.vence),
});

export async function crear(entrada: unknown, ahora = Date.now()): Promise<Confirmacion> {
  const ev = evaluar(entrada);
  if (!ev.documento) throw new Error("Los datos del documento no son válidos: revisalos antes de pedir la confirmación");
  const documento = ev.documento as unknown as Record<string, unknown>;
  const c: Confirmacion = { id: nuevoId(), documento, huella: huellaDe(documento), estado: "pendiente", creada: new Date(ahora).toISOString(), vence: new Date(ahora + VIGENCIA_ENLACE_MS).toISOString() };
  await guardar("confirmaciones", c.id, c);
  return c;
}

export async function responder(id: string, respuesta: unknown, nota: unknown, ahora = Date.now()): Promise<Confirmacion> {
  const c = await leer<Confirmacion>("confirmaciones", id);
  if (!c) throw new Error("Este enlace no existe");
  if (c.estado !== "pendiente") throw new Error("Este enlace ya se usó");
  if (ahora > Date.parse(c.vence)) throw new Error("Este enlace venció");
  if (respuesta !== "confirmada" && respuesta !== "no_coincide") throw new Error("Respuesta no válida");
  // Reclamo exclusivo: si dos respuestas llegan a la vez, solo una gana (el archivo de reclamo no se puede crear dos veces).
  if (!(await reclamar("confirmaciones", id, "respuesta"))) throw new Error("Este enlace ya se usó");
  const actualizada: Confirmacion = { ...c, estado: respuesta, respondida: new Date(ahora).toISOString(), ...(typeof nota === "string" && nota.trim() ? { nota: nota.trim().slice(0, 300) } : {}) };
  // Si el guardado falla, se suelta el reclamo: si no, el enlace quedaría "ya usado" sin respuesta para siempre.
  try { await guardar("confirmaciones", id, actualizada); } catch (e) { await liberar("confirmaciones", id, "respuesta"); throw e; }
  return actualizada;
}
