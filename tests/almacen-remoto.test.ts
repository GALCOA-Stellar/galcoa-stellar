import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { borrar, guardar, leer, liberar, listar, reclamar } from "../src/lib/datos/almacen";
import { remotoActivo } from "../src/lib/datos/almacen-remoto";

const ID = "ab".repeat(16);

/** Base de datos simulada con la misma semántica que PostgREST: upsert, 409 en clave repetida, filtros eq. */
function servidorSimulado() {
  const regs = new Map<string, unknown>();
  const reclamos = new Map<string, string>();
  const llamadas: { metodo: string; url: string; auth: string | null }[] = [];
  const filtro = (u: URL, k: string) => (u.searchParams.get(k) ?? "").replace(/^eq\./, "");
  const respuesta = (status: number, cuerpo: unknown = []) => new Response(JSON.stringify(cuerpo), { status });
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const u = new URL(url);
    const metodo = init.method ?? "GET";
    llamadas.push({ metodo, url, auth: new Headers(init.headers).get("authorization") });
    const tabla = u.pathname.split("/").pop();
    const c = filtro(u, "coleccion"), id = filtro(u, "id"), motivo = filtro(u, "motivo");
    if (tabla === "galcoa_registros") {
      if (metodo === "POST") { const b = JSON.parse(init.body as string); regs.set(`${b.coleccion}/${b.id}`, b.dato); return respuesta(201); }
      if (metodo === "GET") {
        if (id) return respuesta(200, regs.has(`${c}/${id}`) ? [{ dato: regs.get(`${c}/${id}`) }] : []);
        return respuesta(200, [...regs.entries()].filter(([k]) => k.startsWith(`${c}/`)).map(([, dato]) => ({ dato })).reverse());
      }
      if (metodo === "DELETE") { const hubo = regs.delete(`${c}/${id}`); return respuesta(200, hubo ? [{}] : []); }
    }
    if (tabla === "galcoa_reclamos") {
      if (metodo === "POST") { const b = JSON.parse(init.body as string); const k = `${b.coleccion}/${b.id}/${b.motivo}`; if (reclamos.has(k)) return respuesta(409); reclamos.set(k, new Date().toISOString()); return respuesta(201); }
      if (metodo === "GET") { const f = reclamos.get(`${c}/${id}/${motivo}`); return respuesta(200, f ? [{ creado: f }] : []); }
      if (metodo === "DELETE") { for (const k of [...reclamos.keys()]) if (k.startsWith(`${c}/${id}/`) && (!motivo || k.endsWith(`/${motivo}`))) reclamos.delete(k); return respuesta(200); }
    }
    return respuesta(500);
  });
  return { regs, reclamos, llamadas };
}

describe("almacén en base de datos", () => {
  beforeEach(() => { process.env.SUPABASE_URL = "https://ejemplo.supabase.co"; process.env.SUPABASE_SERVICE_KEY = "clave-de-prueba"; });
  afterEach(() => { delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_KEY; vi.unstubAllGlobals(); });

  it("solo se activa con la URL y la clave de servicio", () => {
    expect(remotoActivo({})).toBe(false);
    expect(remotoActivo({ SUPABASE_URL: "x" })).toBe(false);
    expect(remotoActivo({ SUPABASE_URL: "x", SUPABASE_SERVICE_KEY: "y" })).toBe(true);
  });
  it("guarda, lee, lista y borra con la misma interfaz que el almacén en archivos", async () => {
    const s = servidorSimulado();
    await guardar("pruebas", ID, { a: 1 });
    expect(await leer("pruebas", ID)).toEqual({ a: 1 });
    expect(await listar("pruebas")).toEqual([{ a: 1 }]);
    expect(await borrar("pruebas", ID)).toBe(true);
    expect(await leer("pruebas", ID)).toBeNull();
    expect(await borrar("pruebas", ID)).toBe(false);
    expect(s.llamadas.every((l) => l.auth === "Bearer clave-de-prueba")).toBe(true);
  });
  it("el reclamo exclusivo lo gana uno solo, también si llegan a la vez", async () => {
    servidorSimulado();
    const r = await Promise.all(Array.from({ length: 5 }, () => reclamar("pruebas", ID, "uso")));
    expect(r.filter(Boolean)).toHaveLength(1);
    await liberar("pruebas", ID, "uso");
    expect(await reclamar("pruebas", ID, "uso")).toBe(true);
  });
  it("rechaza ids y colecciones inválidos antes de tocar la red", async () => {
    const s = servidorSimulado();
    await expect(guardar("../x", ID, {})).rejects.toThrow("Registro inválido");
    await expect(guardar("pruebas", "no-es-un-id", {})).rejects.toThrow("Registro inválido");
    expect(await leer("pruebas", "no-es-un-id")).toBeNull();
    expect(s.llamadas).toHaveLength(0);
  });
  it("una caída de la base se propaga: no se confunde con que el registro no exista", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 503 }));
    await expect(leer("pruebas", ID)).rejects.toThrow("Base de datos");
    await expect(guardar("pruebas", ID, {})).rejects.toThrow("Base de datos");
  });
});
