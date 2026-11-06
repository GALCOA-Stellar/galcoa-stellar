// Ejemplo ajeno al proyecto: usa SOLO el paquete (sin la app) para armar un lote y verificar un comprobante.
import { armarLote, verificarComprobante, coincideConMemo } from "../index.js";

const manifiestos = ["R-1", "R-2", "R-3", "R-4", "R-5"].map((remito) => ({
  documento: { remito, producto: "Yerba mate 1 kg", unidad: "caja", cantidadPedida: 10, cantidadRecibida: 10, fechaEntrega: "2026-11-02", fechaRegistro: "2026-11-03", cargadoPor: "op-01", confirmadoPor: "sup-02" },
  reglasVersion: "reglas-demo-0.2", reglasIds: ["ALC-COM-01"], veredicto: "verde",
}));
const { memo, comprobantes } = armarLote(manifiestos);
console.log("Huella que iría en el memo de la transacción:", memo);

const c = comprobantes[2];
console.log("Comprobante 3 coherente:", verificarComprobante(c).coherente);
console.log("Coincide con el memo de la red:", coincideConMemo(c, memo));

const alterado = structuredClone(c);
alterado.manifiesto.documento.cantidadRecibida = 11;
console.log("Alterado (cantidad recibida 11):", verificarComprobante(alterado));
