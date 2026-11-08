import { NextResponse } from "next/server";
import { limitarPedido } from "@/lib/servidor/limite";
import { marcarTexto } from "@/lib/stellar/firma";
import { ipDe, leerJson } from "@/lib/servidor/guardas";
import { procesarMensaje } from "@/lib/agentes/flujo";
import { proveedoresDesdeEntorno } from "@/lib/agentes/proveedor";
import { MAX_MENSAJE } from "@/lib/agentes/registrador";

export const runtime = "nodejs";
export const maxDuration = 60;

const ID_INTERNO = /^[A-Za-z0-9._-]{1,60}$/;
const hoyUTC = () => new Date().toISOString().slice(0, 10);

// Tope global por día (mejor esfuerzo en un servidor sin estado): cada pedido cuesta dos llamadas a un modelo.
let diaActual = hoyUTC();
let usados = 0;
const TOPE_DIARIO = Number(process.env.CUPO_AGENTES_DIARIO) || 200;
function hayCupo(): boolean {
  const hoy = hoyUTC();
  if (hoy !== diaActual) { diaActual = hoy; usados = 0; }
  if (usados >= TOPE_DIARIO) return false;
  usados++;
  return true;
}

/**
 * Chat de carga: la persona cuenta la entrega, el Agente 1 propone datos, el Agente 2 los controla contra el mensaje
 * y las reglas (código) deciden el estado. Nada se escribe ni se sella acá.
 */
export async function POST(req: Request) {
  { const lim = await limitarPedido(req, 5); if (lim) return lim; }
  const config = proveedoresDesdeEntorno();
  if (!config) return NextResponse.json({ error: "Los agentes de IA no están configurados en este entorno" }, { status: 503 });
  try {
    const c = (await leerJson(req, 10_000)) as { mensaje?: unknown; cargadoPor?: unknown; evidenciaHash?: unknown };
    if (typeof c.mensaje !== "string" || c.mensaje.trim() === "") return NextResponse.json({ error: "Escribí qué entrega querés cargar" }, { status: 400 });
    if (c.mensaje.length > MAX_MENSAJE) return NextResponse.json({ error: `El mensaje es demasiado largo (máximo ${MAX_MENSAJE} caracteres)` }, { status: 400 });
    if (typeof c.cargadoPor !== "string" || !ID_INTERNO.test(c.cargadoPor)) return NextResponse.json({ error: "Falta quién carga (un identificador interno, sin datos personales)" }, { status: 400 });
    if (!hayCupo()) return NextResponse.json({ error: "Se alcanzó el tope diario de uso de los agentes" }, { status: 429 });
    const hoy = hoyUTC();
    const evidenciaHash = typeof c.evidenciaHash === "string" && /^[0-9a-f]{64}$/.test(c.evidenciaHash) ? c.evidenciaHash : undefined;
    const r = await procesarMensaje(config, c.mensaje, c.cargadoPor, hoy, evidenciaHash);
    // El estado del chat se devuelve firmado por el servidor: así la confirmación no puede cambiar lo que dijeron los agentes.
    const datos = JSON.stringify({ propuestas: r.propuestas, hallazgos: r.hallazgos, cargadoPor: c.cargadoPor, hoy, emitidoEn: Date.now(), ...(evidenciaHash ? { evidenciaHash } : {}) });
    return NextResponse.json({ ...r, datos, marca: marcarTexto(datos) });
  } catch (e) {
    console.error("agentes/registrar:", e instanceof Error ? e.message : e);
    const permitido = ["Se espera JSON", "Pedido de otro sitio", "Cuerpo demasiado", "El Agente"];
    return NextResponse.json({ error: e instanceof Error && permitido.some((p) => e.message.startsWith(p)) ? e.message : "No se pudo procesar el mensaje" }, { status: 400 });
  }
}
