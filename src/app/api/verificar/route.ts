import { NextResponse } from "next/server";
import { limitarPedido } from "@/lib/servidor/limite";
import { verificarComprobante, type Comprobante } from "@/lib/aplicacion/lote";
import { cuentasSelladoras, leerMemo, motivoSinRed, urlExplorador, verificarPruebaLocal } from "@/lib/stellar/stellar";
import { consultarRegistro, consultarConsumo } from "@/lib/stellar/contrato";
import { cuentasAutorizadas } from "@/lib/stellar/firma";
import { leerJson } from "@/lib/servidor/guardas";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  { const lim = await limitarPedido(req, 20); if (lim) return lim; }
  try {
    const c = (await leerJson(req)) as Comprobante;
    const local = verificarComprobante(c);
    if (!local.coherente) return NextResponse.json({ verificado: false, paso: "comprobante", motivo: local.motivo });
    const lectura = await leerMemo(c.txHash);
    const caida = lectura === "indisponible";
    const red = caida ? null : lectura;
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
      // La prueba guardada la trae el propio comprobante y no lleva una firma que podamos comprobar sin la red: NUNCA da "verificado".
      // Solo se informa como "coherente, sin confirmar" y únicamente si la transacción de adentro es de una cuenta selladora conocida.
      const guardada = verificarPruebaLocal(c, local.memoEsperado);
      if (guardada.ok && guardada.origen && cuentasSelladoras().includes(guardada.origen)) {
        return NextResponse.json({
          verificado: false,
          coherenteSinRed: true,
          paso: "prueba-guardada",
          motivo: `${guardada.motivo + (caida ? ". No pudimos consultar la red" : ". La red no tiene esa transacción (puede ser un reinicio de la testnet)")}: esto NO confirma que la red haya incluido la transacción.`,
          ledger: c.prueba?.ledger,
          cierreLedger: c.prueba?.cierreLedger ?? null,
        });
      }
      if (guardada.ok) {
        return NextResponse.json({ verificado: false, paso: "origen", motivo: "La prueba guardada no es de una cuenta selladora de GALCOA+: cualquiera puede armar una igual. No se verifica." });
      }
      return NextResponse.json({ verificado: false, paso: "red", pendiente: true, indisponible: caida, motivo: motivoSinRed(caida, guardada.motivo) });
    }
    const memoCoincide = red.memoHex === local.memoEsperado;
    const bruto = memoCoincide ? await consultarRegistro(local.memoEsperado) : null;
    // Un memo igual lo puede mandar cualquiera: solo vale si lo originó una cuenta selladora conocida o si el contrato de registro lo tiene vigente.
    const origenConocido = !!red.origen && cuentasSelladoras().includes(red.origen);
    const coincide = memoCoincide && (origenConocido || bruto?.estado === "vigente");
    if (memoCoincide && !coincide) {
      return NextResponse.json({ verificado: false, paso: "origen", motivo: "Esa transacción tiene la huella del lote pero no la mandó una cuenta selladora de GALCOA+ ni figura en el contrato de registro: cualquiera puede mandar un memo igual. No se verifica.", ledger: red.ledger, explorador: urlExplorador(c.txHash) });
    }
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
