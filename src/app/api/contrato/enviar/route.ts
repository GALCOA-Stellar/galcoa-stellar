import { NextResponse } from "next/server";
import { previsualizarLote } from "@/lib/lote";
import { enviarRegistro, type DatosRegistro } from "@/lib/contrato";
import { marcaDeTextoValida } from "@/lib/firma";
import { ipDe, leerJson, limitar } from "@/lib/guardas";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Paso 2: recibe las firmas de las dos personas y envía el registro al contrato. La red vuelve a exigir las dos autorizaciones. */
export async function POST(req: Request) {
  if (!limitar(ipDe(req), 6)) return NextResponse.json({ error: "Demasiados pedidos. Probá en un minuto." }, { status: 429 });
  try {
    const c = (await leerJson(req)) as { documentos?: unknown; datos?: unknown; marca?: unknown; firmas?: unknown };
    if (typeof c.datos !== "string" || !marcaDeTextoValida(c.datos, c.marca)) return NextResponse.json({ error: "Los datos no fueron emitidos por este servidor" }, { status: 403 });
    const datos = JSON.parse(c.datos) as DatosRegistro;
    const vista = previsualizarLote(c.documentos as unknown[]);
    if (!vista.memo || vista.memo !== datos.memo) return NextResponse.json({ error: "Los documentos no coinciden con lo que se preparó" }, { status: 403 });
    const firmas = Array.isArray(c.firmas) ? (c.firmas as { cuenta?: unknown; firma?: unknown }[]).filter((f) => typeof f.cuenta === "string" && typeof f.firma === "string") as { cuenta: string; firma: string }[] : [];
    if (!firmas.some((f) => f.cuenta === datos.cargador) || !firmas.some((f) => f.cuenta === datos.aprobador)) return NextResponse.json({ error: "Faltan las firmas de las dos personas" }, { status: 403 });
    const reg = await enviarRegistro(datos, firmas);
    console.log(JSON.stringify({ flujo: datos.memo, paso: "registro-enviado", ...reg })); // la huella es el identificador común del flujo
    return NextResponse.json({ memo: datos.memo, cargador: datos.cargador, aprobador: datos.aprobador, ...reg });
  } catch (e) {
    const permitido = ["El contrato rechazó", "Stellar rechazó", "La red no confirmó", "Falta la firma", "La firma de", "Mandá al menos", "Máximo", "Se espera JSON", "Pedido de otro sitio", "Cuerpo demasiado"];
    console.error("contrato/enviar:", e);
    return NextResponse.json({ error: e instanceof Error && permitido.some((p) => e.message.startsWith(p)) ? e.message : "No se pudo registrar" }, { status: 400 });
  }
}
