import { NextResponse } from "next/server";
import { verificarComprobante, type Comprobante } from "@/lib/lote";
import { leerMemo, urlExplorador, verificarPruebaLocal } from "@/lib/stellar";
import { consultarRegistro, consultarConsumo } from "@/lib/contrato";
import { cuentasAutorizadas } from "@/lib/firma";
import { ipDe, leerJson, limitar } from "@/lib/guardas";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!limitar(ipDe(req), 20)) return NextResponse.json({ error: "Demasiados pedidos. Probá en un minuto." }, { status: 429 });
  try {
    const c = (await leerJson(req)) as Comprobante;
    const local = verificarComprobante(c);
    if (!local.coherente) return NextResponse.json({ verificado: false, paso: "comprobante", motivo: local.motivo });
    const red = await leerMemo(c.txHash);
    if (!red) {
      // Lotes registrados por contrato (la transacción no lleva memo de hash): la prueba es el propio contrato de registro,
      // que guarda la huella del lote con las dos cuentas que lo firmaron.
      const enContrato = await consultarRegistro(local.memoEsperado);
      if (enContrato && (enContrato.estado === "vigente" || enContrato.estado === "revocado")) {
        const lista = cuentasAutorizadas();
        const vigente = enContrato.estado === "vigente";
        const consumo = await consultarConsumo(local.memoEsperado);
        return NextResponse.json({
          consumo,
          contrato: { ...enContrato, cuentasConocidas: lista ? lista.includes(enContrato.cargador ?? "") && lista.includes(enContrato.aprobador ?? "") : null },
          verificado: vigente,
          paso: "contrato",
          motivo: vigente ? "El lote figura vigente en el contrato de registro de Stellar" : "El lote figura en el contrato de registro pero fue revocado",
          ledger: enContrato.ledger,
          explorador: urlExplorador(c.txHash),
        });
      }
      // La red ya no tiene el historial (reinicio de testnet o ventana vencida): se usa la prueba guardada, diciendo con claridad qué prueba y qué no.
      const guardada = verificarPruebaLocal(c, local.memoEsperado);
      if (guardada.ok) {
        return NextResponse.json({
          verificado: true,
          paso: "prueba-guardada",
          motivo: guardada.motivo + ". No se pudo consultar la red: esto no confirma que la red haya incluido la transacción.",
          ledger: c.prueba?.ledger,
          cierreLedger: c.prueba?.cierreLedger ?? null,
        });
      }
      return NextResponse.json({ verificado: false, paso: "red", pendiente: true, motivo: "Todavía no figura en la red. Si lo acabás de enviar, está pendiente: esperá unos segundos y volvé a verificar. Si pasó mucho tiempo, puede que la testnet se haya reiniciado. " + guardada.motivo });
    }
    const coincide = red.memoHex === local.memoEsperado;
    const bruto = coincide ? await consultarRegistro(local.memoEsperado) : null;
    // Con el contrato nuevo solo el servicio registra, pero igual solo se da el ✔ si las dos cuentas son de la lista de conocidas.
    const lista = cuentasAutorizadas();
    const contrato = bruto?.cargador ? { ...bruto, cuentasConocidas: lista ? lista.includes(bruto.cargador ?? "") && lista.includes(bruto.aprobador ?? "") : null } : bruto;
    const consumo = coincide && bruto?.registrado ? await consultarConsumo(local.memoEsperado) : null;
    return NextResponse.json({
      consumo,
      contrato,
      verificado: coincide,
      paso: coincide ? "completo" : "red",
      motivo: coincide ? "El documento está en el lote sellado en Stellar" : "El memo de la red no coincide con el lote",
      ledger: red.ledger,
      explorador: urlExplorador(c.txHash),
    });
  } catch {
    return NextResponse.json({ error: "No se pudo leer o verificar el comprobante" }, { status: 400 });
  }
}
