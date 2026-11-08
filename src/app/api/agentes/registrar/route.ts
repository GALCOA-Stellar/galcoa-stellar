import { NextResponse } from "next/server";
import { limitarPedido } from "@/lib/servidor/limite";
import { marcarTexto } from "@/lib/stellar/firma";
import { ErrorDeForma, leerCuerpo } from "@/lib/servidor/guardas";
import { procesarMensaje } from "@/lib/agentes/flujo";
import { proveedoresDesdeEntorno } from "@/lib/agentes/proveedor";
import { pedidoRegistrar } from "@/lib/dominio/esquemas";
import { registrarError } from "@/lib/servidor/registro";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    const c = await leerCuerpo(req, pedidoRegistrar, 10_000);
    if (!hayCupo()) return NextResponse.json({ error: "Se alcanzó el tope diario de uso de los agentes" }, { status: 429 });
    const hoy = hoyUTC();
    const evidenciaHash = c.evidenciaHash;
    const r = await procesarMensaje(config, c.mensaje, c.cargadoPor, hoy, evidenciaHash);
    // El estado del chat se devuelve firmado por el servidor: así la confirmación no puede cambiar lo que dijeron los agentes.
    const datos = JSON.stringify({ propuestas: r.propuestas, hallazgos: r.hallazgos, cargadoPor: c.cargadoPor, hoy, emitidoEn: Date.now(), ...(evidenciaHash ? { evidenciaHash } : {}) });
    return NextResponse.json({ ...r, datos, marca: marcarTexto(datos) });
  } catch (e) {
    if (e instanceof ErrorDeForma) return NextResponse.json({ error: e.message }, { status: 400 });
    registrarError("agentes/registrar", e);
    const permitido = ["Se espera JSON", "Pedido de otro sitio", "Cuerpo demasiado", "El Agente"];
    return NextResponse.json({ error: e instanceof Error && permitido.some((p) => e.message.startsWith(p)) ? e.message : "No se pudo procesar el mensaje" }, { status: 400 });
  }
}
