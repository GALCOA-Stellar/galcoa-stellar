/**
 * Almacén en base de datos (Postgres vía la API REST de Supabase, sin dependencias nuevas).
 * Se usa solo si están SUPABASE_URL y SUPABASE_SERVICE_KEY; si no, sigue el almacén en archivos de siempre.
 * La clave de servicio vive solo en variables de entorno y nunca llega al navegador. Tablas y RLS: supabase/migraciones/.
 * Estado: escrito y probado con un servidor simulado; NO probado todavía contra un proyecto real de Supabase.
 */
import "server-only";
export const remotoActivo = (env: Record<string, string | undefined> = process.env) => Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY);

/** Las claves nuevas (sb_...) no son JWT: solo van en apikey. Las viejas (JWT) también en authorization. */
export const cabeceraClave = (k: string): Record<string, string> => (k.startsWith("sb_") ? { apikey: k } : { apikey: k, authorization: `Bearer ${k}` });

async function pedir(metodo: string, ruta: string, cuerpo?: unknown, extra: Record<string, string> = {}): Promise<Response> {
  const base = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const clave = process.env.SUPABASE_SERVICE_KEY ?? "";
  return fetch(`${base}/rest/v1/${ruta}`, {
    method: metodo,
    headers: { ...cabeceraClave(clave), "content-type": "application/json", ...extra },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(8000),
  });
}
async function exigir(r: Response, que: string): Promise<Response> {
  if (!r.ok) throw new Error(`Base de datos: ${que} falló (${r.status})`);
  return r;
}
const clave = (c: string, id: string) => `coleccion=eq.${encodeURIComponent(c)}&id=eq.${encodeURIComponent(id)}`;

export async function guardarRemoto(c: string, id: string, dato: object): Promise<void> {
  await exigir(await pedir("POST", "galcoa_registros?on_conflict=coleccion,id", { coleccion: c, id, dato }, { prefer: "resolution=merge-duplicates,return=minimal" }), "guardar");
}
export async function leerRemoto<T>(c: string, id: string): Promise<T | null> {
  const filas = (await (await exigir(await pedir("GET", `galcoa_registros?${clave(c, id)}&select=dato`), "leer")).json()) as { dato: T }[];
  return filas[0]?.dato ?? null;
}
export async function listarRemoto<T>(c: string, limite: number): Promise<T[]> {
  const filas = (await (await exigir(await pedir("GET", `galcoa_registros?coleccion=eq.${encodeURIComponent(c)}&select=dato&order=creado.desc&limit=${limite}`), "listar")).json()) as { dato: T }[];
  return filas.map((f) => f.dato).reverse();
}
/** Reclamo exclusivo: la clave primaria hace que solo uno gane (409 = ya estaba tomado). */
export async function reclamarRemoto(c: string, id: string, motivo: string, caducaMs?: number): Promise<boolean> {
  const crear = () => pedir("POST", "galcoa_reclamos", { coleccion: c, id, motivo }, { prefer: "return=minimal" });
  const r = await crear();
  if (r.ok) return true;
  if (r.status !== 409) throw new Error(`Base de datos: reclamar falló (${r.status})`);
  if (caducaMs === undefined) return false;
  const filas = (await (await exigir(await pedir("GET", `galcoa_reclamos?${clave(c, id)}&motivo=eq.${encodeURIComponent(motivo)}&select=creado`), "reclamar")).json()) as { creado: string }[];
  if (!filas[0] || Date.now() - Date.parse(filas[0].creado) <= caducaMs) return false;
  // Solo se borra el reclamo viejo (el filtro por fecha evita pisar uno que otro proceso acaba de tomar).
  await pedir("DELETE", `galcoa_reclamos?${clave(c, id)}&motivo=eq.${encodeURIComponent(motivo)}&creado=eq.${encodeURIComponent(filas[0].creado)}`);
  return (await crear()).ok;
}
export async function liberarRemoto(c: string, id: string, motivo: string): Promise<void> {
  await exigir(await pedir("DELETE", `galcoa_reclamos?${clave(c, id)}&motivo=eq.${encodeURIComponent(motivo)}`), "liberar");
}
export async function borrarRemoto(c: string, id: string): Promise<boolean> {
  await exigir(await pedir("DELETE", `galcoa_reclamos?${clave(c, id)}`), "borrar");
  const filas = (await (await exigir(await pedir("DELETE", `galcoa_registros?${clave(c, id)}`, undefined, { prefer: "return=representation" }), "borrar")).json()) as unknown[];
  return filas.length > 0;
}
