import { NextResponse } from "next/server";
import { limitarPedido } from "@/lib/servidor/limite";
import { marcaDeTextoValida } from "@/lib/stellar/firma";
import { leerJson, mensajePublico } from "@/lib/servidor/guardas";
import { confirmarPropuestas } from "@/lib/agentes/flujo";
import type { Propuesta } from "@/lib/agentes/registrador";
import type { Hallazgo } from "@/lib/agentes/verificador";

export const runtime = "nodejs";

const ID_INTERNO = /^[A-Za-z0-9._-]{1,60}$/;
const VIGENCIA_MS = 6 * 60 * 60 * 1000; // 6 horas para que la segunda persona confirme

/**
 * Segunda persona confirma lo que cargó la primera. Sin IA: el servidor recupera el estado firmado del chat,
 * vuelve a aplicar las reglas con las dos personas y devuelve los documentos listos para sellar (lo rojo queda afuera).
 */
export async function POST(req: Request) {
  { const lim = await limitarPedido(req, 20); if (lim) return lim; }
  try {
    const c = (await leerJson(req)) as { datos?: unknown; marca?: unknown; confirmadoPor?: unknown };
    if (typeof c.datos !== "string" || !marcaDeTextoValida(c.datos, c.marca)) return NextResponse.json({ error: "Los datos no fueron emitidos por este servidor" }, { status: 403 });
    if (typeof c.confirmadoPor !== "string" || !ID_INTERNO.test(c.confirmadoPor)) return NextResponse.json({ error: "Falta quién confirma" }, { status: 400 });
    const estado = JSON.parse(c.datos) as { propuestas: Propuesta[]; hallazgos: Hallazgo[] | null; cargadoPor: string; hoy: string; emitidoEn?: number; evidenciaHash?: string };
    if (!Array.isArray(estado.propuestas) || typeof estado.cargadoPor !== "string" || typeof estado.hoy !== "string") return NextResponse.json({ error: "Los datos no tienen el formato esperado" }, { status: 400 });
    // Un estado firmado vence: no se puede reconfirmar al día siguiente con la fecha de carga vieja.
    if (typeof estado.emitidoEn !== "number" || Date.now() - estado.emitidoEn > VIGENCIA_MS) return NextResponse.json({ error: "La carga venció. Volvé a cargarla para confirmarla." }, { status: 410 });
    return NextResponse.json(confirmarPropuestas(estado.propuestas, estado.hallazgos, estado.cargadoPor, c.confirmadoPor, estado.hoy, typeof estado.evidenciaHash === "string" ? estado.evidenciaHash : undefined));
  } catch (e) {
        return NextResponse.json({ error: mensajePublico(e, [], "No se pudo confirmar") }, { status: 400 });
  }
}
