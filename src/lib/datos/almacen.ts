import "server-only";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { borrarRemoto, guardarRemoto, leerRemoto, liberarRemoto, listarRemoto, reclamarRemoto, remotoActivo } from "./almacen-remoto";

/**
 * Almacén mínimo de registros (un archivo JSON por registro) para confirmaciones del comercio e historial.
 * Es para prototipo y piloto local: en un servidor sin disco persistente se pierde al reiniciar. La interfaz
 * (guardar / leer / listar) es la misma que tendría una base real (por ejemplo Supabase), así que cambiarla
 * no toca el resto. Nunca guarda claves ni secretos, y a Stellar solo van huellas, no estos datos.
 */
/** Carpeta de datos. En Vercel el disco de la app es de solo lectura: se usa la carpeta temporal (se pierde al reiniciar la instancia). */
export const carpetaDeDatos = () => process.env.GALCOA_DATOS || (process.env.VERCEL ? join("/tmp", "galcoa-datos") : join(process.cwd(), ".datos"));
const RAIZ = carpetaDeDatos;
const ID = /^[0-9a-f]{32}$/;
const COLECCION = /^[a-z]{3,20}$/;

export const nuevoId = () => randomBytes(16).toString("hex");
export const idValido = (id: unknown): id is string => typeof id === "string" && ID.test(id);

function ruta(coleccion: string, id: string): string {
  if (!COLECCION.test(coleccion) || !ID.test(id)) throw new Error("Registro inválido");
  return join(RAIZ(), coleccion, `${id}.json`);
}

export async function guardar<T extends object>(coleccion: string, id: string, dato: T): Promise<void> {
  if (remotoActivo()) { ruta(coleccion, id); return guardarRemoto(coleccion, id, dato); }
  const destino = ruta(coleccion, id);
  await mkdir(join(RAIZ(), coleccion), { recursive: true });
  const tmp = `${destino}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(tmp, JSON.stringify(dato), "utf8");
  await rename(tmp, destino); // escritura atómica: nunca queda un archivo a medias
}

/** Reclamo exclusivo: devuelve true solo la primera vez para ese registro y motivo (crear el archivo falla si ya existe). */
export async function reclamar(coleccion: string, id: string, motivo: string, caducaMs?: number): Promise<boolean> {
  if (!/^[a-z]{3,20}$/.test(motivo)) throw new Error("Registro inválido");
  if (remotoActivo()) { ruta(coleccion, id); return reclamarRemoto(coleccion, id, motivo, caducaMs); }
  const destino = `${ruta(coleccion, id)}.${motivo}.lock`;
  await mkdir(join(RAIZ(), coleccion), { recursive: true });
  try { await writeFile(destino, "", { flag: "wx" }); return true; } catch { /* ya existe: ¿está vencido? */ }
  if (caducaMs !== undefined) {
    try {
      if (Date.now() - (await stat(destino)).mtimeMs > caducaMs) { // el proceso que lo tomó murió: se libera y se reintenta una vez
        await unlink(destino).catch(() => {});
        await writeFile(destino, "", { flag: "wx" });
        return true;
      }
    } catch { /* otro proceso lo tomó primero */ }
  }
  return false;
}

/** Suelta un reclamo (por ejemplo si el envío falló y se puede reintentar). */
export async function liberar(coleccion: string, id: string, motivo: string): Promise<void> {
  if (!/^[a-z]{3,20}$/.test(motivo)) throw new Error("Registro inválido");
  if (remotoActivo()) { ruta(coleccion, id); return liberarRemoto(coleccion, id, motivo); }
  try { await unlink(`${ruta(coleccion, id)}.${motivo}.lock`); } catch { /* ya no estaba */ }
}

/** Borra el registro y sus archivos de reclamo. Devuelve true si existía. */
export async function borrar(coleccion: string, id: string): Promise<boolean> {
  const archivo = ruta(coleccion, id);
  if (remotoActivo()) return borrarRemoto(coleccion, id);
  let existia = true;
  try { await unlink(archivo); } catch { existia = false; }
  try {
    const carpeta = join(RAIZ(), coleccion);
    for (const n of await readdir(carpeta)) if (n.startsWith(`${id}.`) && n.endsWith(".lock")) await unlink(join(carpeta, n)).catch(() => {});
  } catch { /* la carpeta no existe */ }
  return existia;
}

export async function leer<T>(coleccion: string, id: string): Promise<T | null> {
  if (remotoActivo()) return COLECCION.test(coleccion) && ID.test(id) ? leerRemoto<T>(coleccion, id) : null; // una caída de la base se propaga: no se confunde con "no existe"
  try { return JSON.parse(await readFile(ruta(coleccion, id), "utf8")) as T; } catch { return null; }
}

export async function listar<T>(coleccion: string, limite = 200): Promise<T[]> {
  if (!COLECCION.test(coleccion)) throw new Error("Registro inválido");
  if (remotoActivo()) return listarRemoto<T>(coleccion, limite);
  let nombres: string[] = [];
  try { nombres = (await readdir(join(RAIZ(), coleccion))).filter((n) => n.endsWith(".json")); } catch { return []; }
  const todos = await Promise.all(nombres.map(async (n) => { try { return JSON.parse(await readFile(join(RAIZ(), coleccion, n), "utf8")) as T; } catch { return null; } }));
  return (todos.filter(Boolean) as T[]).slice(-limite);
}
