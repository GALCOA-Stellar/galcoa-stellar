import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { borrar, guardar, leer, liberar, nuevoId, reclamar } from "./almacen";
import { huellaDe } from "./confirmacion";
import { evaluar } from "../dominio/rules";
import { DATOS_PUBLICOS } from "./sello-comercio";

/**
 * Ronda de confirmación por terceros: cada participante confirma por SU enlace privado el MISMO documento congelado.
 * Invitaciones con token y estado agregado, sin tocar la confirmación simple del comercio (`confirmacion.ts`), que sigue igual.
 *
 * Qué prueba: que quien tenía cada enlace declaró "lo recibí así" o "no coincide", en esa fecha y hora del servidor.
 * Qué NO prueba: quién es cada persona ni que sean personas distintas (alguien podría reenviar un enlace). Por eso el
 * texto dice "declaró", nunca "certificó" ni "validó". El nombre es autodeclarado.
 */
export const VIGENCIA_RONDA_MS = 7 * 24 * 60 * 60_000;
export const ROLES = ["proveedor", "comprador", "transportista"] as const;
export type Rol = (typeof ROLES)[number];
/** Proveedor y comprador siempre; el transportista es opcional. */
export const OBLIGATORIOS: readonly Rol[] = ["proveedor", "comprador"];

export type RespuestaTercero = "confirmada" | "no_coincide";
export type EstadoInvitacion = "pendiente" | RespuestaTercero;
export type EstadoRonda = "pendiente" | "completa" | "rechazada" | "vencida";

export type Ronda = { id: string; documento: Record<string, unknown>; huella: string; roles: Rol[]; invitaciones: string[]; creada: string; vence: string };
/** En disco se guarda SOLO el hash del token, nunca el enlace en claro. */
export type Invitacion = {
  id: string; tokenHash: string; rondaId: string; rol: Rol; creada: string; vence: string; revocada?: boolean;
  estado: EstadoInvitacion; nombre?: string; respondida?: string; nota?: string;
};

const PATRON_TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const tokenBienFormado = (t: unknown): t is string => typeof t === "string" && PATRON_TOKEN.test(t);
export const nuevoToken = () => randomBytes(32).toString("base64url");
export const hashDeToken = (t: string) => createHash("sha256").update(t, "utf8").digest("hex");
/** Clave de búsqueda en el almacén: los primeros 128 bits del hash (el almacén usa ids de 32 caracteres hexadecimales). */
export const claveDeToken = (t: string) => hashDeToken(t).slice(0, 32);

const COL_RONDAS = "rondas";
const COL_INVITACIONES = "invitaciones";
const iguales = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function validarRoles(roles: unknown): Rol[] {
  if (!Array.isArray(roles)) throw new Error("Elegí quiénes confirman");
  const lista = roles.filter((r): r is Rol => (ROLES as readonly unknown[]).includes(r));
  if (lista.length !== roles.length || new Set(lista).size !== lista.length) throw new Error("Los participantes no son válidos");
  for (const o of OBLIGATORIOS) if (!lista.includes(o)) throw new Error("Tienen que confirmar al menos el proveedor y el comprador");
  return ROLES.filter((r) => lista.includes(r)); // orden estable
}

async function emitir(rondaId: string, rol: Rol, vence: string, ahora: number): Promise<{ invitacion: Invitacion; token: string }> {
  const token = nuevoToken();
  const invitacion: Invitacion = { id: claveDeToken(token), tokenHash: hashDeToken(token), rondaId, rol, creada: new Date(ahora).toISOString(), vence, estado: "pendiente" };
  await guardar(COL_INVITACIONES, invitacion.id, invitacion);
  return { invitacion, token };
}

/** Crea la ronda y un enlace por participante. Los enlaces en claro se devuelven UNA sola vez: después no se pueden recuperar (se reemiten). */
export async function crearRonda(entrada: unknown, roles: unknown, ahora = Date.now()): Promise<{ ronda: Ronda; tokens: Partial<Record<Rol, string>> }> {
  const ev = evaluar(entrada);
  if (!ev.documento) throw new Error("Los datos del documento no son válidos: revisalos antes de pedir la confirmación");
  const participantes = validarRoles(roles);
  const documento = ev.documento as unknown as Record<string, unknown>;
  const id = nuevoId();
  const vence = new Date(ahora + VIGENCIA_RONDA_MS).toISOString();
  const tokens: Partial<Record<Rol, string>> = {};
  const ids: string[] = [];
  for (const rol of participantes) {
    const { invitacion, token } = await emitir(id, rol, vence, ahora);
    tokens[rol] = token;
    ids.push(invitacion.id);
  }
  const ronda: Ronda = { id, documento, huella: huellaDe(documento), roles: participantes, invitaciones: ids, creada: new Date(ahora).toISOString(), vence };
  await guardar(COL_RONDAS, id, ronda);
  return { ronda, tokens };
}

/** La invitación vigente de cada rol: la más nueva que no fue revocada. */
async function vigentes(ronda: Ronda): Promise<Map<Rol, Invitacion>> {
  const todas = (await Promise.all(ronda.invitaciones.map((i) => leer<Invitacion>(COL_INVITACIONES, i)))).filter(Boolean) as Invitacion[];
  const mapa = new Map<Rol, Invitacion>();
  for (const inv of todas) if (!inv.revocada) mapa.set(inv.rol, inv); // al reemitir se agrega al final: gana la más nueva
  return mapa;
}

export type ResumenRonda = {
  id: string; huella: string; estado: EstadoRonda; vence: string;
  requeridos: number; confirmaron: number; rechazaron: number; faltan: Rol[];
  /** Todos confirmaron el mismo documento congelado y nadie lo rechazó. */
  completa: boolean;
  detalle: { rol: Rol; estado: EstadoInvitacion; sinEnlace: boolean; nombre?: string; respondida?: string; nota?: string }[];
};

export async function resumenDe(rondaId: string, ahora = Date.now()): Promise<ResumenRonda | null> {
  const ronda = await leer<Ronda>(COL_RONDAS, rondaId);
  if (!ronda) return null;
  const v = await vigentes(ronda);
  const detalle = ronda.roles.map((rol) => {
    const inv = v.get(rol);
    return { rol, estado: (inv?.estado ?? "pendiente") as EstadoInvitacion, sinEnlace: !inv, nombre: inv?.nombre, respondida: inv?.respondida, nota: inv?.nota };
  });
  const confirmaron = detalle.filter((d) => d.estado === "confirmada").length;
  const rechazaron = detalle.filter((d) => d.estado === "no_coincide").length;
  const completa = rechazaron === 0 && confirmaron === ronda.roles.length;
  const estado: EstadoRonda = rechazaron > 0 ? "rechazada" : completa ? "completa" : ahora > Date.parse(ronda.vence) ? "vencida" : "pendiente";
  return { id: ronda.id, huella: ronda.huella, estado, vence: ronda.vence, requeridos: ronda.roles.length, confirmaron, rechazaron, faltan: detalle.filter((d) => d.estado === "pendiente").map((d) => d.rol), completa, detalle };
}

async function invitacionDeToken(token: unknown): Promise<Invitacion | null> {
  if (!tokenBienFormado(token)) return null; // forma inválida: no se consulta el almacén
  const inv = await leer<Invitacion>(COL_INVITACIONES, claveDeToken(token));
  if (!inv || !iguales(inv.tokenHash, hashDeToken(token)) || inv.revocada) return null;
  return inv;
}

/** Lo que ve cada participante: solo los datos que le tocan. Leer NUNCA consume el enlace (ni siquiera una precarga). Enlace mal formado, inexistente o revocado: la misma respuesta (null). */
export async function leerInvitacion(token: unknown, ahora = Date.now()) {
  const inv = await invitacionDeToken(token);
  if (!inv) return null;
  const ronda = await leer<Ronda>(COL_RONDAS, inv.rondaId);
  if (!ronda) return null;
  const r = await resumenDe(ronda.id, ahora);
  return {
    rol: inv.rol, estado: inv.estado, vence: inv.vence, respondida: inv.respondida, vencida: ahora > Date.parse(inv.vence),
    documento: Object.fromEntries(DATOS_PUBLICOS.filter((k) => ronda.documento[k] !== undefined).map((k) => [k, ronda.documento[k]])),
    ronda: r ? { estado: r.estado, confirmaron: r.confirmaron, requeridos: r.requeridos } : null,
  };
}

export async function responderInvitacion(token: unknown, respuesta: unknown, nombre: unknown, nota: unknown, ahora = Date.now()): Promise<{ estado: RespuestaTercero; respondida: string }> {
  const inv = await invitacionDeToken(token);
  if (!inv) throw new Error("Este enlace no existe");
  if (inv.estado !== "pendiente") throw new Error("Este enlace ya se usó");
  if (ahora > Date.parse(inv.vence)) throw new Error("Este enlace venció");
  if (respuesta !== "confirmada" && respuesta !== "no_coincide") throw new Error("Respuesta no válida");
  const quien = typeof nombre === "string" ? nombre.trim() : "";
  if (quien.length < 2 || quien.length > 80) throw new Error("Escribí tu nombre (entre 2 y 80 letras)");
  const ronda = await leer<Ronda>(COL_RONDAS, inv.rondaId);
  if (!ronda) throw new Error("Este enlace no existe");
  // Todos confirman el MISMO documento congelado: si los datos guardados ya no coinciden con su huella, no se acepta ninguna respuesta.
  if (huellaDe(ronda.documento) !== ronda.huella) throw new Error("Los datos de esta ronda cambiaron: pedí un enlace nuevo");
  // Reclamo exclusivo: si dos respuestas al mismo enlace llegan a la vez, solo una gana.
  if (!(await reclamar(COL_INVITACIONES, inv.id, "respuesta"))) throw new Error("Este enlace ya se usó");
  const respondida = new Date(ahora).toISOString();
  const actualizada: Invitacion = { ...inv, estado: respuesta, nombre: quien, respondida, ...(typeof nota === "string" && nota.trim() ? { nota: nota.trim().slice(0, 300) } : {}) };
  // Cada respuesta va a SU propio registro (dos participantes nunca se pisan). Si el guardado falla, se suelta el reclamo para poder reintentar.
  try { await guardar(COL_INVITACIONES, inv.id, actualizada); } catch (e) { await liberar(COL_INVITACIONES, inv.id, "respuesta"); throw e; }
  return { estado: respuesta, respondida };
}

/** La distribuidora anula el enlace de un participante que todavía no respondió. */
export async function revocarInvitacion(rondaId: string, rol: Rol): Promise<void> {
  const ronda = await leer<Ronda>(COL_RONDAS, rondaId);
  if (!ronda?.roles.includes(rol)) throw new Error("Esa ronda no existe");
  const inv = (await vigentes(ronda)).get(rol);
  if (!inv) throw new Error("Ese participante ya no tiene un enlace vigente");
  if (inv.estado !== "pendiente") throw new Error("Ese participante ya respondió");
  await guardar(COL_INVITACIONES, inv.id, { ...inv, revocada: true });
}

/** Reemite el enlace de un participante que no respondió: anula el anterior y entrega uno nuevo (en claro, una sola vez). */
export async function reemitirInvitacion(rondaId: string, rol: Rol, ahora = Date.now()): Promise<{ token: string; vence: string }> {
  const ronda = await leer<Ronda>(COL_RONDAS, rondaId);
  if (!ronda?.roles.includes(rol)) throw new Error("Esa ronda no existe");
  const actual = (await vigentes(ronda)).get(rol);
  if (actual && actual.estado !== "pendiente") throw new Error("Ese participante ya respondió");
  if (actual) await guardar(COL_INVITACIONES, actual.id, { ...actual, revocada: true });
  const vence = new Date(ahora + VIGENCIA_RONDA_MS).toISOString();
  const { invitacion, token } = await emitir(ronda.id, rol, vence, ahora);
  await guardar(COL_RONDAS, ronda.id, { ...ronda, invitaciones: [...ronda.invitaciones, invitacion.id] });
  return { token, vence };
}

/** Privacidad: las rondas (con nombres autodeclarados y comentarios) se borran 30 días después de vencer, igual que las confirmaciones simples. */
export async function borrarRondaVencida(ronda: Ronda): Promise<void> {
  for (const i of ronda.invitaciones) await borrar(COL_INVITACIONES, i);
  await borrar(COL_RONDAS, ronda.id);
}
