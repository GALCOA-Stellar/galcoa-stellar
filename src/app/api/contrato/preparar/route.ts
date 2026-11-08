import { NextResponse } from "next/server";
import { limitarPedido } from "@/lib/servidor/limite";
import { cargadoresDelLote, previsualizarLote } from "@/lib/aplicacion/lote";
import { prepararRegistro } from "@/lib/stellar/contrato";
import { cuentasAutorizadas, identidadDe, marcarTexto } from "@/lib/stellar/firma";
import { leerJson, mensajePublico } from "@/lib/servidor/guardas";
import { registrarError } from "@/lib/servidor/registro";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Paso 1 del registro en el contrato con billeteras: devuelve el texto que cada persona debe firmar. La huella la calcula el servidor. */
export async function POST(req: Request) {
  { const lim = await limitarPedido(req, 10); if (lim) return lim; }
  try {
    const c = (await leerJson(req)) as { documentos?: unknown; cargador?: unknown; aprobador?: unknown };
    const autorizadas = cuentasAutorizadas();
    if (!autorizadas) return NextResponse.json({ error: "El registro en el contrato no está configurado" }, { status: 503 });
    if (typeof c.cargador !== "string" || typeof c.aprobador !== "string") return NextResponse.json({ error: "Faltan las dos cuentas" }, { status: 400 });
    if (!autorizadas.includes(c.cargador) || !autorizadas.includes(c.aprobador)) return NextResponse.json({ error: "Alguna de las cuentas no está autorizada" }, { status: 403 });
    if (identidadDe(c.cargador) === identidadDe(c.aprobador)) return NextResponse.json({ error: "Las dos cuentas son de la misma persona" }, { status: 403 });
    const vista = previsualizarLote(c.documentos as unknown[]);
    if (!vista.memo) return NextResponse.json({ error: "No hay nada para registrar" }, { status: 400 });
    if ([c.cargador, c.aprobador].every((g) => cargadoresDelLote(c.documentos as unknown[]).includes(identidadDe(g as string))))
      return NextResponse.json({ error: "Cuatro ojos: al menos una de las dos personas no tiene que haber cargado documentos de este lote" }, { status: 403 });
    const { datos, porFirmar } = await prepararRegistro(vista.memo, c.cargador, c.aprobador);
    const texto = JSON.stringify(datos);
    return NextResponse.json({ datos: texto, marca: marcarTexto(texto), porFirmar, memo: vista.memo });
  } catch (e) {
    registrarError("contrato/preparar", e);
    return NextResponse.json({ error: mensajePublico(e, ["El contrato rechazó", "Hacen falta", "Falta configurar", "Mandá al menos", "Máximo"], "No se pudo preparar el registro") }, { status: 400 });
  }
}
