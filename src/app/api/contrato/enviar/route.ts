import { NextResponse } from "next/server";
import { limitarPedido } from "@/lib/servidor/limite";
import { previsualizarLote } from "@/lib/aplicacion/lote";
import { enviarRegistro, type DatosRegistro } from "@/lib/stellar/contrato";
import { marcaDeTextoValida } from "@/lib/stellar/firma";
import { leerJson, mensajePublico } from "@/lib/servidor/guardas";
import { registrarError, registrarEvento } from "@/lib/servidor/registro";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Paso 2: recibe las firmas de las dos personas y envía el registro al contrato. La red vuelve a exigir las dos autorizaciones. */
export async function POST(req: Request) {
  { const lim = await limitarPedido(req, 6); if (lim) return lim; }
  try {
    const c = (await leerJson(req)) as { documentos?: unknown; datos?: unknown; marca?: unknown; firmas?: unknown };
    if (typeof c.datos !== "string" || !marcaDeTextoValida(c.datos, c.marca)) return NextResponse.json({ error: "Los datos no fueron emitidos por este servidor" }, { status: 403 });
    const datos = JSON.parse(c.datos) as DatosRegistro;
    const vista = previsualizarLote(c.documentos as unknown[]);
    if (!vista.memo || vista.memo !== datos.memo) return NextResponse.json({ error: "Los documentos no coinciden con lo que se preparó" }, { status: 403 });
    const firmas = Array.isArray(c.firmas) ? (c.firmas as { cuenta?: unknown; firma?: unknown }[]).filter((f) => typeof f.cuenta === "string" && typeof f.firma === "string") as { cuenta: string; firma: string }[] : [];
    if (!firmas.some((f) => f.cuenta === datos.cargador) || !firmas.some((f) => f.cuenta === datos.aprobador)) return NextResponse.json({ error: "Faltan las firmas de las dos personas" }, { status: 403 });
    const reg = await enviarRegistro(datos, firmas);
    registrarEvento({ flujo: datos.memo, paso: "registro-enviado", ...reg }); // la huella es el identificador común del flujo
    return NextResponse.json({ memo: datos.memo, cargador: datos.cargador, aprobador: datos.aprobador, ...reg });
  } catch (e) {
    registrarError("contrato/enviar", e);
    return NextResponse.json({ error: mensajePublico(e, ["El contrato rechazó", "Stellar rechazó", "La red no confirmó", "Falta la firma", "La firma de", "Mandá al menos", "Máximo"], "No se pudo registrar") }, { status: 400 });
  }
}
