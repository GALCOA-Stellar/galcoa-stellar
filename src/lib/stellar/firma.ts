import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Compara en tiempo constante y por bytes: un texto con caracteres no ASCII no puede hacer fallar la comparación. */
function igualConstante(a: unknown, b: string): boolean {
  if (typeof a !== "string") return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { RED } from "./red";

/**
 * Acceso por firma de cuenta (SEP-53), en lugar de un código compartido.
 *
 * La persona firma, con la clave de su cuenta de Stellar, un mensaje que dice QUÉ lote confirma (su huella exacta).
 * El servidor comprueba: que el mensaje lo emitió él (marca HMAC), que no venció, que nombra a esa cuenta y a ese lote,
 * que la cuenta está autorizada y que la firma es válida. Así queda registrado quién confirmó el sello.
 * Una firma prueba que una CUENTA firmó, no quién es la persona detrás: por eso hay una lista de cuentas autorizadas.
 */

export const PREFIJO_SEP53 = "Stellar Signed Message:\n";
export const VIGENCIA_MS = 5 * 60_000;
const ENCABEZADO = "GALCOA+ en Stellar";
const ACCION = "Confirmo y sello este lote";

/** SEP-53: hash = SHA-256( "Stellar Signed Message:\n" + mensaje ), firmado con ed25519. */
export const hashSep53 = (mensaje: string): Buffer => createHash("sha256").update(PREFIJO_SEP53 + mensaje, "utf8").digest();

export function verificarFirmaSep53(cuenta: string, mensaje: string, firmaBase64: string): boolean {
  try {
    if (!StrKey.isValidEd25519PublicKey(cuenta)) return false;
    const firma = Buffer.from(firmaBase64, "base64");
    if (firma.length !== 64) return false;
    return Keypair.fromPublicKey(cuenta).verify(hashSep53(mensaje), firma);
  } catch {
    return false;
  }
}

let secretoLocal: Buffer | null = null;
function secretoDeMarca(): Buffer | null {
  const configurado = process.env.DESAFIO_SECRETO;
  if (configurado) return Buffer.from(configurado, "utf8");
  if (process.env.NODE_ENV === "production") return null; // en producción es obligatorio
  secretoLocal ??= randomBytes(32);
  return secretoLocal; // desarrollo local: secreto efímero
}

const marcaDe = (mensaje: string, secreto: Buffer) => createHmac("sha256", secreto).update(mensaje).digest("hex");

/** Marca HMAC de un texto emitido por este servidor (para datos que el navegador devuelve sin poder alterarlos). */
export function marcarTexto(texto: string): string {
  const secreto = secretoDeMarca();
  if (!secreto) throw new Error("Falta configurar DESAFIO_SECRETO");
  return marcaDe(`datos:${texto}`, secreto);
}
export function marcaDeTextoValida(texto: string, marca: unknown): boolean {
  const secreto = secretoDeMarca();
  if (!secreto || typeof marca !== "string") return false;
  const esperada = marcaDe(`datos:${texto}`, secreto);
  return igualConstante(marca, esperada);
}

/** Cuentas autorizadas a confirmar sellos (variable CUENTAS_AUTORIZADAS, separadas por coma). */
export function cuentasAutorizadas(): string[] | null {
  const crudo = process.env.CUENTAS_AUTORIZADAS;
  if (!crudo?.trim()) return null;
  return crudo.split(",").map((c) => c.trim().split("=")[0].trim()).filter(Boolean);
}

/**
 * Identificador interno de la persona detrás de una cuenta autorizada (formato "G...=usuario-01" en CUENTAS_AUTORIZADAS).
 * Sin "=", la identidad es la cuenta misma. Sirve para la regla de cuatro ojos: quien aprueba no puede haber cargado.
 */
export function identidadDe(cuenta: string): string {
  const par = (process.env.CUENTAS_AUTORIZADAS ?? "").split(",").map((c) => c.trim()).find((c) => c.split("=")[0].trim() === cuenta);
  const id = par?.split("=")[1]?.trim();
  return id ? id : cuenta;
}

/** En producción hace falta una lista; sin lista nadie puede sellar. En desarrollo, sin lista, vale cualquier cuenta con firma válida. */
export function cuentaAutorizada(cuenta: string): boolean {
  const lista = cuentasAutorizadas();
  if (!lista) return process.env.NODE_ENV !== "production";
  return lista.includes(cuenta);
}

export const mensajeDeConfirmacion = (p: { cuenta: string; memo: string; vence: string; codigo: string }) =>
  [ENCABEZADO, `Acción: ${ACCION}`, `Cuenta: ${p.cuenta}`, `Huella del lote: ${p.memo}`, `Red: ${RED}`, `Vence: ${p.vence}`, `Código: ${p.codigo}`].join("\n");

/** Arma el mensaje que la persona debe firmar. Sin estado: la marca HMAC prueba que lo emitió este servidor. */
export function emitirDesafio(cuenta: string, memo: string, ahora = Date.now()): { mensaje: string; marca: string } {
  const secreto = secretoDeMarca();
  if (!secreto) throw new Error("Falta configurar DESAFIO_SECRETO");
  if (!StrKey.isValidEd25519PublicKey(cuenta)) throw new Error("Cuenta inválida");
  if (!/^[0-9a-f]{64}$/.test(memo)) throw new Error("Huella inválida");
  const mensaje = mensajeDeConfirmacion({ cuenta, memo, vence: new Date(ahora + VIGENCIA_MS).toISOString(), codigo: randomBytes(16).toString("hex") });
  return { mensaje, marca: marcaDe(`desafio:${mensaje}`, secreto) };
}

export type Acceso = { cuenta: string; mensaje: string; marca: string; firma: string };
export type ResultadoAcceso = { ok: true; cuenta: string } | { ok: false; motivo: string };

const usados = new Map<string, number>(); // mejor esfuerzo contra reutilización (en servidor sin estado puede reiniciarse)

/** Comprueba el acceso firmado contra la huella del lote que se está por sellar. */
export function verificarAcceso(acceso: unknown, memoEsperado: string | null, ahora = Date.now()): ResultadoAcceso {
  const secreto = secretoDeMarca();
  if (!secreto) return { ok: false, motivo: "El servidor no está configurado para confirmar sellos" };
  if (!memoEsperado) return { ok: false, motivo: "No hay nada para sellar" };
  const a = acceso as Partial<Acceso> | null;
  if (!a || typeof a.cuenta !== "string" || typeof a.mensaje !== "string" || typeof a.marca !== "string" || typeof a.firma !== "string")
    return { ok: false, motivo: "Falta la firma de una cuenta autorizada" };
  const esperada = marcaDe(`desafio:${a.mensaje}`, secreto);
  if (!igualConstante(a.marca, esperada))
    return { ok: false, motivo: "El mensaje firmado no fue emitido por este servidor" };
  const campos = new Map(a.mensaje.split("\n").map((l) => { const i = l.indexOf(": "); return i > 0 ? [l.slice(0, i), l.slice(i + 2)] as [string, string] : ["", ""] as [string, string]; }));
  const vence = Date.parse(campos.get("Vence") ?? "");
  if (!Number.isFinite(vence) || ahora > vence) return { ok: false, motivo: "El mensaje venció: pedí uno nuevo" };
  if (campos.get("Cuenta") !== a.cuenta) return { ok: false, motivo: "El mensaje no corresponde a esa cuenta" };
  if (campos.get("Huella del lote") !== memoEsperado) return { ok: false, motivo: "La firma corresponde a otro lote: revisá y firmá de nuevo" };
  if (campos.get("Red") !== RED) return { ok: false, motivo: "La firma es para otra red" };
  if (!cuentaAutorizada(a.cuenta)) return { ok: false, motivo: "Esa cuenta no está autorizada para confirmar sellos" };
  if (!verificarFirmaSep53(a.cuenta, a.mensaje, a.firma)) return { ok: false, motivo: "La firma no es válida" };
  const codigo = campos.get("Código") ?? "";
  for (const [k, v] of usados) if (v < ahora) usados.delete(k);
  if (usados.has(codigo)) return { ok: false, motivo: "Esa firma ya se usó: pedí un mensaje nuevo" };
  usados.set(codigo, vence);
  return { ok: true, cuenta: a.cuenta };
}

// ---- Sesión (D2): entrar con la firma de la cuenta; el servidor emite un pase firmado con la identidad de la persona ----
const ACCION_SESION = "Inicio sesión en GALCOA+";
export const VIGENCIA_SESION_MS = 8 * 60 * 60_000;

/** Mensaje de inicio de sesión (no sella nada; el campo "Huella del lote" lleva un valor fijo). */
export function emitirDesafioSesion(cuenta: string, ahora = Date.now()): { mensaje: string; marca: string } {
  const secreto = secretoDeMarca();
  if (!secreto) throw new Error("Falta configurar DESAFIO_SECRETO");
  if (!StrKey.isValidEd25519PublicKey(cuenta)) throw new Error("Cuenta inválida");
  const mensaje = [ENCABEZADO, `Acción: ${ACCION_SESION}`, `Cuenta: ${cuenta}`, `Red: ${RED}`, `Vence: ${new Date(ahora + VIGENCIA_MS).toISOString()}`, `Código: ${randomBytes(16).toString("hex")}`].join("\n");
  return { mensaje, marca: marcaDe(`desafio:${mensaje}`, secreto) };
}

/** Verifica el inicio de sesión y devuelve el pase "cuenta|identidad|vence.marca". */
export function abrirSesion(acceso: unknown, ahora = Date.now()): { ok: true; pase: string; cuenta: string; identidad: string } | { ok: false; motivo: string } {
  const secreto = secretoDeMarca();
  if (!secreto) return { ok: false, motivo: "El servidor no está configurado" };
  const a = acceso as Partial<Acceso> | null;
  if (!a || typeof a.cuenta !== "string" || typeof a.mensaje !== "string" || typeof a.marca !== "string" || typeof a.firma !== "string") return { ok: false, motivo: "Falta la firma" };
  const esperada = marcaDe(`desafio:${a.mensaje}`, secreto);
  if (!igualConstante(a.marca, esperada)) return { ok: false, motivo: "El mensaje no fue emitido por este servidor" };
  const campos = new Map(a.mensaje.split("\n").map((l) => { const i = l.indexOf(": "); return i > 0 ? [l.slice(0, i), l.slice(i + 2)] as [string, string] : ["", ""] as [string, string]; }));
  if (campos.get("Acción") !== ACCION_SESION) return { ok: false, motivo: "El mensaje no es de inicio de sesión" };
  const vence = Date.parse(campos.get("Vence") ?? "");
  if (!Number.isFinite(vence) || ahora > vence) return { ok: false, motivo: "El mensaje venció" };
  if (campos.get("Cuenta") !== a.cuenta) return { ok: false, motivo: "El mensaje no corresponde a esa cuenta" };
  if (!cuentaAutorizada(a.cuenta)) return { ok: false, motivo: "Esa cuenta no está autorizada" };
  if (!verificarFirmaSep53(a.cuenta, a.mensaje, a.firma)) return { ok: false, motivo: "La firma no es válida" };
  const identidad = identidadDe(a.cuenta);
  const cuerpo = `${a.cuenta}|${identidad}|${ahora + VIGENCIA_SESION_MS}`;
  return { ok: true, pase: `${Buffer.from(cuerpo).toString("base64url")}.${marcaDe(`sesion:${cuerpo}`, secreto)}`, cuenta: a.cuenta, identidad };
}

/** Comprueba un pase de sesión. */
export function leerSesion(pase: unknown, ahora = Date.now()): { cuenta: string; identidad: string } | null {
  const secreto = secretoDeMarca();
  if (!secreto || typeof pase !== "string") return null;
  const [b64, marca] = pase.split(".");
  if (!b64 || !marca) return null;
  const cuerpo = Buffer.from(b64, "base64url").toString("utf8");
  const esperada = marcaDe(`sesion:${cuerpo}`, secreto);
  if (!igualConstante(marca, esperada)) return null;
  const [cuenta, identidad, vence] = cuerpo.split("|");
  if (!cuenta || !identidad || !(Number(vence) > ahora) || !cuentaAutorizada(cuenta)) return null;
  return { cuenta, identidad };
}

// ---- Evidencia multimedia (ALC-VOZ-04): una cuenta autorizada respalda la huella exacta de un archivo ----
const ACCION_EVIDENCIA = "Respaldo esta evidencia";

/** Mensaje para que una cuenta autorizada respalde un archivo concreto (su huella SHA-256). No sirve para sellar lotes. */
export function emitirDesafioEvidencia(cuenta: string, huella: string, ahora = Date.now()): { mensaje: string; marca: string } {
  const secreto = secretoDeMarca();
  if (!secreto) throw new Error("Falta configurar DESAFIO_SECRETO");
  if (!StrKey.isValidEd25519PublicKey(cuenta)) throw new Error("Cuenta inválida");
  if (!/^[0-9a-f]{64}$/.test(huella)) throw new Error("Huella inválida");
  const mensaje = [ENCABEZADO, `Acción: ${ACCION_EVIDENCIA}`, `Cuenta: ${cuenta}`, `Huella de la evidencia: ${huella}`, `Red: ${RED}`, `Vence: ${new Date(ahora + VIGENCIA_MS).toISOString()}`, `Código: ${randomBytes(16).toString("hex")}`].join("\n");
  return { mensaje, marca: marcaDe(`desafio:${mensaje}`, secreto) };
}

/** Dice si una cuenta autorizada firmó, con un mensaje emitido por este servidor y vigente, la huella esperada. */
export function evidenciaRespaldada(acceso: unknown, huellaEsperada: string, ahora = Date.now()): { cuentaAutorizada: boolean; firmaValida: boolean; cuenta?: string } {
  const secreto = secretoDeMarca();
  const a = acceso as Partial<Acceso> | null;
  if (!secreto || !a || typeof a.cuenta !== "string" || typeof a.mensaje !== "string" || typeof a.marca !== "string" || typeof a.firma !== "string") return { cuentaAutorizada: false, firmaValida: false };
  const autorizada = cuentaAutorizada(a.cuenta);
  if (!igualConstante(a.marca, marcaDe(`desafio:${a.mensaje}`, secreto))) return { cuentaAutorizada: autorizada, firmaValida: false };
  const campos = new Map(a.mensaje.split("\n").map((l) => { const i = l.indexOf(": "); return i > 0 ? [l.slice(0, i), l.slice(i + 2)] as [string, string] : ["", ""] as [string, string]; }));
  const vence = Date.parse(campos.get("Vence") ?? "");
  const coincide = campos.get("Acción") === ACCION_EVIDENCIA && campos.get("Cuenta") === a.cuenta && campos.get("Huella de la evidencia") === huellaEsperada && campos.get("Red") === RED && Number.isFinite(vence) && ahora <= vence;
  const firmaValida = coincide && verificarFirmaSep53(a.cuenta, a.mensaje, a.firma);
  return { cuentaAutorizada: autorizada, firmaValida, cuenta: a.cuenta };
}
